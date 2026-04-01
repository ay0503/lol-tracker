/**
 * LP Polling Engine
 * Runs every 2 minutes to:
 * 1. Check live game status (for trading halt enforcement)
 * 2. Fetch current LP from Riot API
 * 3. Store price snapshot
 * 4. Fetch new matches and store them
 * 5. Generate AI meme news for new matches
 * 6. Distribute dividends for new matches
 * 7. Execute pending limit orders and stop-losses
 * 8. Update market status
 */
import {
  fetchFullPlayerData, tierToPrice, tierToTotalLP,
  getActiveGame, getMatchIds, getMatchDetails,
} from "./riotApi";
import { cache } from "./cache";
import {
  addPriceSnapshot, getProcessedMatchIds, addMatch, markMatchDividendsPaid,
  markMatchNewsGenerated, distributeDividends, addNews, getPendingOrders,
  fillOrder, executeTrade, setMarketStatus, getLatestPrice, getOrCreateHolding,
  executeShort, executeCover, recordPortfolioSnapshots, createNotification,
  getPriceHistory, getRecentMatchesFromDB, getLeaderboard, pruneOldPriceHistory, pruneOldPortfolioSnapshots,
  resolveBets, getRawClient,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { computeAllETFPricesSync, TICKERS as ETF_TICKERS } from "./etfPricing";
import { runBotTrader, ensureBotUser } from "./botTrader";
import {
  notifyGameStart, notifyGameEnd, notifyNewMatch, notifyRankChange,
  notifyStreak, notifyBigPriceMove, notifyDailySummary, isDiscordConfigured,
} from "./discord";

// Player config
const GAME_NAME = "목도리 도마뱀";
const TAG_LINE = "dori";
const PUUID_CACHE: { puuid?: string } = {};

// Polling interval (30 seconds)
const POLL_INTERVAL_MS = 30 * 1000;

let pollTimer: NodeJS.Timeout | null = null;
let isPolling = false;
let lastPollTime: Date | null = null;
let lastPollResult: PollResult | null = null;

// Two-consecutive-confirmation for live game detection.
// The confirmed status only flips when two consecutive raw checks agree.
// This prevents false toggles from API flickers and provides a ~2 min delay.
let previousRawIsInGame: boolean | null = null; // raw result from last poll
let confirmedIsInGame = false; // only changes after 2 consecutive agreeing polls
let consecutiveApiErrors = 0; // auto-release live status after 3 consecutive API failures

// Pre-game snapshot for post-game LP notification banner
let preGameSnapshot: {
  lp: number;
  tier: string;
  division: string;
  totalLP: number;
  price: number;
  timestamp: number;
} | null = null;

// Previous rank for rank-change detection
let previousTier: string | null = null;
let previousDivision: string | null = null;

// Track last notified streak/match to prevent duplicate Discord messages
let lastNotifiedStreakCount = 0;
let lastNotifiedMatchId: string | null = null;

// Snapshot throttling: only store if price changed or 5 min elapsed
let lastSnapshotPrice: number | null = null;
let lastSnapshotTime = 0;
const SNAPSHOT_MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Portfolio snapshot throttling: every 10 minutes
let lastPortfolioSnapshotTime = 0;
const PORTFOLIO_SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000;

// Daily summary: track last summary date to send once per day
let lastDailySummaryDate: string | null = null;

// Restore last daily summary date from DB to prevent duplicates across restarts
async function loadLastDailySummaryDate(): Promise<void> {
  try {
    const client = getRawClient();
    await client.execute(`CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    const result = await client.execute({ sql: `SELECT value FROM app_state WHERE key = ?`, args: ["lastDailySummaryDate"] });
    if (result.rows.length > 0) {
      lastDailySummaryDate = String((result.rows[0] as any).value);
    }
  } catch { /* ignore */ }
}

async function saveLastDailySummaryDate(dateKey: string): Promise<void> {
  try {
    const client = getRawClient();
    await client.execute({
      sql: `INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?`,
      args: ["lastDailySummaryDate", dateKey, dateKey],
    });
  } catch { /* ignore */ }
}

// Game-end event stored in cache for frontend to poll
export interface GameEndEvent {
  lpBefore: number;
  lpAfter: number;
  lpDelta: number;
  tierBefore: string;
  divisionBefore: string;
  tierAfter: string;
  divisionAfter: string;
  priceBefore: number;
  priceAfter: number;
  priceChange: number;
  priceChangePct: number;
  timestamp: number;
  win?: boolean; // actual match result from Riot API (may be set after initial event)
}

export interface PollResult {
  timestamp: Date;
  price: number;
  tier: string;
  division: string;
  lp: number;
  wins: number;
  losses: number;
  newMatches: number;
  newsGenerated: number;
  dividendsPaid: number;
  ordersExecuted: number;
  errors: string[];
}

/**
 * ETF price calculation — uses the unified compounding module.
 * Kept as a thin wrapper for backward compatibility within pollEngine.
 */
const TICKERS = ETF_TICKERS;

/**
 * Main polling function
 */
export async function pollNow(): Promise<PollResult> {
  if (isPolling) {
    return lastPollResult || { timestamp: new Date(), price: 0, tier: "", division: "", lp: 0, wins: 0, losses: 0, newMatches: 0, newsGenerated: 0, dividendsPaid: 0, ordersExecuted: 0, errors: ["Poll already in progress"] };
  }

  isPolling = true;
  const result: PollResult = {
    timestamp: new Date(), price: 0, tier: "", division: "", lp: 0,
    wins: 0, losses: 0, newMatches: 0, newsGenerated: 0,
    dividendsPaid: 0, ordersExecuted: 0, errors: [],
  };

  try {
    // 1. Fetch player data (single call, reused for game check + LP)
    let playerData: Awaited<ReturnType<typeof fetchFullPlayerData>>;
    try {
      playerData = await fetchFullPlayerData(GAME_NAME, TAG_LINE);
      PUUID_CACHE.puuid = playerData.account.puuid;
    } catch (err: any) {
      result.errors.push(`Failed to fetch player data: ${err.message}`);
      return result;
    }

    if (!playerData.soloEntry) {
      result.errors.push("No solo/duo ranked data found");
      return result;
    }

    // 2. Check live game status with two-consecutive-confirmation
    // ONLY Ranked Solo/Duo (queue 420) counts as "in game" for trading purposes.
    // Other modes (Flex, ARAM, Normals) don't affect DORI price and should not halt trading.
    let rawIsInGame = false;
    let spectatorApiOk = false;
    let activeGameData: Awaited<ReturnType<typeof getActiveGame>> = null;
    try {
      activeGameData = await getActiveGame(playerData.account.puuid);
      // Only treat Ranked Solo/Duo as "in game"
      rawIsInGame = !!activeGameData && activeGameData.gameQueueConfigId === 420;
      if (activeGameData && activeGameData.gameQueueConfigId !== 420) {
        console.log(`[Poll] Ignoring non-Solo/Duo game (queue=${activeGameData.gameQueueConfigId})`);
      }
      spectatorApiOk = true;
    } catch (err: any) {
      // Spectator API flaky — skip confirmation this cycle
    }

    // Two-consecutive-confirmation logic
    const wasConfirmedInGame = confirmedIsInGame;
    if (spectatorApiOk) {
      if (previousRawIsInGame !== null && rawIsInGame === previousRawIsInGame && rawIsInGame !== confirmedIsInGame) {
        confirmedIsInGame = rawIsInGame;
        console.log(`[Poll] Live game CONFIRMED: ${confirmedIsInGame ? "IN GAME" : "not in game"} (after 2 consecutive checks)`);
      }
      previousRawIsInGame = rawIsInGame;
      consecutiveApiErrors = 0;
    } else {
      // If API keeps erroring while we think we're in game, auto-release after 3 consecutive failures
      consecutiveApiErrors++;
      if (confirmedIsInGame && consecutiveApiErrors >= 3) {
        confirmedIsInGame = false;
        previousRawIsInGame = false;
        console.log(`[Poll] Live game AUTO-RELEASED after ${consecutiveApiErrors} consecutive API errors`);
      }
    }

    // Track game-start: capture pre-game LP/price snapshot
    if (!wasConfirmedInGame && confirmedIsInGame) {
      try {
        const snapEntry = playerData.soloEntry;
        const snapTotalLP = tierToTotalLP(snapEntry.tier, snapEntry.rank, snapEntry.leaguePoints);
        const snapPrice = tierToPrice(snapEntry.tier, snapEntry.rank, snapEntry.leaguePoints);
        preGameSnapshot = {
          lp: snapEntry.leaguePoints,
          tier: snapEntry.tier,
          division: snapEntry.rank,
          totalLP: snapTotalLP,
          price: snapPrice,
          timestamp: Date.now(),
        };
        console.log(`[Poll] Game START detected — snapshot: ${snapEntry.tier} ${snapEntry.rank} ${snapEntry.leaguePoints}LP, $${snapPrice.toFixed(2)}`);

        // Discord notification — reuse activeGameData instead of re-fetching
        const participant = activeGameData?.participants.find(p => p.puuid === playerData.account.puuid);
        const queueNames: Record<number, string> = { 420: "Ranked Solo/Duo", 440: "Ranked Flex", 400: "Normal Draft", 450: "ARAM" };
        const gameMode = activeGameData ? queueNames[activeGameData.gameQueueConfigId] ?? "Unknown" : undefined;
        notifyGameStart(participant?.championId ? `ID ${participant.championId}` : undefined, gameMode).catch(() => {});
      } catch (err: any) {
        console.warn("[Poll] Failed to capture pre-game snapshot:", err?.message);
      }
    }

    // Update the cache with the CONFIRMED status (used by trade endpoints + bot)
    cache.set("player.liveGame.check", confirmedIsInGame, 45_000); // 45s TTL (slightly > poll interval)

    // Cache game details from the poll so the liveGame route doesn't re-fetch
    // Only cache for Solo/Duo games (the only mode that triggers confirmedIsInGame)
    if (confirmedIsInGame && activeGameData && activeGameData.gameQueueConfigId === 420) {
      const participant = activeGameData.participants.find(pp => pp.puuid === playerData.account.puuid);
      cache.set("player.liveGame.details", {
        inGame: true as const,
        gameMode: "Ranked Solo/Duo",
        gameStartTime: activeGameData.gameStartTime,
        gameLengthSeconds: activeGameData.gameLength,
        championId: participant?.championId,
        isRanked: true,
      }, 45_000);
    } else if (!confirmedIsInGame) {
      cache.invalidate("player.liveGame.details");
    }

    const { tier, rank: division, leaguePoints: lp, wins, losses } = playerData.soloEntry;
    const totalLP = tierToTotalLP(tier, division, lp);
    const price = tierToPrice(tier, division, lp);

    // Emit game-end event now that we have current LP/price
    if (wasConfirmedInGame && !confirmedIsInGame && preGameSnapshot) {
      // Use totalLP (absolute LP across all tiers) for accurate delta calculation
      const lpDelta = totalLP - preGameSnapshot.totalLP;
      const priceChange = price - preGameSnapshot.price;
      const priceChangePct = preGameSnapshot.price > 0
        ? (priceChange / preGameSnapshot.price) * 100
        : 0;

      // Skip game-end event if LP didn't change (likely a false detection or non-Solo/Duo game)
      if (lpDelta === 0 && priceChange === 0) {
        console.log(`[Poll] Suppressing game-end event: 0 LP change, likely false detection`);
        preGameSnapshot = null;
      } else {
      const gameEndEvent: GameEndEvent = {
        lpBefore: preGameSnapshot.lp,
        lpAfter: lp,
        lpDelta,
        tierBefore: preGameSnapshot.tier,
        divisionBefore: preGameSnapshot.division,
        tierAfter: tier,
        divisionAfter: division,
        priceBefore: preGameSnapshot.price,
        priceAfter: price,
        priceChange,
        priceChangePct,
        timestamp: Date.now(),
      };

      // Store in cache with 10-minute TTL so frontend can poll for it
      cache.set("player.gameEndEvent", gameEndEvent, 10 * 60 * 1000);
      console.log(`[Poll] Game END event: LP ${preGameSnapshot.lp} → ${lp} (${lpDelta >= 0 ? "+" : ""}${lpDelta}), Price $${preGameSnapshot.price.toFixed(2)} → $${price.toFixed(2)} (${priceChange >= 0 ? "+" : ""}${priceChange.toFixed(2)})`);

      // Discord notification for game end
      notifyGameEnd(lpDelta, preGameSnapshot.price, price).catch(() => {});

      // Clear pre-game snapshot
      preGameSnapshot = null;
      } // end else (lpDelta !== 0)
    }

    result.price = price;
    result.tier = tier;
    result.division = division;
    result.lp = lp;
    result.wins = wins;
    result.losses = losses;

    // Get previous price snapshot BEFORE storing the new one (for LP change calculation)
    const previousPrice = await getLatestPrice();

    // 2. Store price snapshot (throttled: only if price changed or 5 min elapsed)
    const now = Date.now();
    const priceChanged = lastSnapshotPrice === null || Math.abs(price - lastSnapshotPrice) >= 0.005;
    const timeElapsed = now - lastSnapshotTime >= SNAPSHOT_MIN_INTERVAL_MS;
    if (priceChanged || timeElapsed) {
      console.log(`[Poll] Price: $${price.toFixed(2)} (${tier} ${division} ${lp}LP) — snapshot saved`);
      await addPriceSnapshot({ timestamp: now, tier, division, lp, totalLP, price, wins, losses });
      lastSnapshotPrice = price;
      lastSnapshotTime = now;
    } else {
    }

    // 3. Fetch and process new matches
    // First get match IDs, filter out already-processed ones, then only fetch details for new ones
    const puuid = playerData.account.puuid;
    const recentMatchIds = await getMatchIds(puuid, 10, 420);
    const processedIds = await getProcessedMatchIds();
    const newMatchIds = recentMatchIds.filter(id => !processedIds.has(id));

    // Match-history-based game end: if we're "in game" but new matches appeared,
    // the game is definitely over — more reliable than waiting for spectator 404
    if (confirmedIsInGame && newMatchIds.length > 0) {
      console.log(`[Poll] New match detected while in-game → forcing game END`);
      confirmedIsInGame = false;
      previousRawIsInGame = false;
      consecutiveApiErrors = 0;
      cache.set("player.liveGame.check", false, 45_000);
      cache.invalidate("player.liveGame.details");
    }

    // Max game duration safety valve: no LoL game lasts >90 min
    if (confirmedIsInGame && preGameSnapshot && (Date.now() - preGameSnapshot.timestamp > 90 * 60 * 1000)) {
      console.log(`[Poll] Game exceeded 90min → forcing game END (safety valve)`);
      confirmedIsInGame = false;
      previousRawIsInGame = false;
      consecutiveApiErrors = 0;
      cache.set("player.liveGame.check", false, 45_000);
      cache.invalidate("player.liveGame.details");
    }


    const prevPrice = previousPrice ? parseFloat(previousPrice.price) : price;

    for (const matchId of newMatchIds) {
      let match;
      try {
        match = await getMatchDetails(matchId);
        await new Promise(r => setTimeout(r, 100)); // rate limit delay
      } catch (err: any) {
        result.errors.push(`Failed to fetch match ${matchId}: ${err.message}`);
        continue;
      }

      const participant = match.info.participants.find(p => p.puuid === puuid);
      if (!participant) continue;

      // Remake detection: game < 5 minutes AND 0/0/0 KDA
      const isRemake = match.info.gameDuration < 300 &&
        participant.kills === 0 && participant.deaths === 0 && participant.assists === 0;

      if (isRemake) {
        console.log(`[Poll] Match ${matchId} detected as REMAKE (${Math.floor(match.info.gameDuration / 60)}m, 0/0/0 KDA on ${participant.championName})`);
      }

      try {
        await addMatch({
          matchId,
          win: participant.win,
          champion: participant.championName,
          kills: participant.kills,
          deaths: participant.deaths,
          assists: participant.assists,
          cs: participant.totalMinionsKilled + participant.neutralMinionsKilled,
          position: participant.teamPosition || participant.individualPosition,
          gameDuration: match.info.gameDuration,
          priceBefore: isRemake ? prevPrice : prevPrice,
          priceAfter: isRemake ? prevPrice : price, // Remakes don't change price
          gameCreation: match.info.gameCreation,
          isRemake,
        });
        result.newMatches++;

        // Update game-end event with actual match result (win/loss)
        if (!isRemake) {
          const existingEndEvent = cache.get<GameEndEvent>("player.gameEndEvent");
          if (existingEndEvent && existingEndEvent.win === undefined) {
            existingEndEvent.win = participant.win;
            cache.set("player.gameEndEvent", existingEndEvent, 10 * 60 * 1000);
          }
        }

        // Skip news generation and dividends for remakes
        if (isRemake) {
          console.log(`[Poll] Skipping news/dividends for remake match ${matchId}`);
          continue;
        }

        // 4. Distribute dividends (base + share bonus + rubber banding)
        try {
          const reason = participant.win
            ? `Win on ${participant.championName} (${participant.kills}/${participant.deaths}/${participant.assists})`
            : `Loss on ${participant.championName} (${participant.kills}/${participant.deaths}/${participant.assists})`;
          // Estimate LP change from previous snapshot
          const lpChange = previousPrice ? totalLP - previousPrice.totalLP : 0;
          const divResult = await distributeDividends(matchId, participant.win, reason, lpChange);
          await markMatchDividendsPaid(matchId);
          result.dividendsPaid += divResult.holdersCount;
          console.log(`[Poll] Dividends: $${divResult.totalDistributed.toFixed(2)} to ${divResult.holdersCount} holders`);
        } catch (err: any) {
          result.errors.push(`Dividend error for ${matchId}: ${err.message}`);
        }

        // 5. Generate AI meme news
        try {
          const newsHeadline = await generateMemeNews(
            participant.championName,
            participant.win,
            participant.kills,
            participant.deaths,
            participant.assists,
            price,
            prevPrice,
            participant.totalMinionsKilled + participant.neutralMinionsKilled,
            match.info.gameDuration,
            participant.teamPosition || "UNKNOWN"
          );

          if (newsHeadline) {
            await addNews({
              headline: newsHeadline.headline,
              body: newsHeadline.body,
              matchId,
              isWin: participant.win,
              champion: participant.championName,
              kda: `${participant.kills}/${participant.deaths}/${participant.assists}`,
              priceChange: price - prevPrice,
            });
            await markMatchNewsGenerated(matchId);
            result.newsGenerated++;
          }
        } catch (err: any) {
          result.errors.push(`News gen error for ${matchId}: ${err.message}`);
        }

        // Discord: notify new match result
        notifyNewMatch(
          participant.championName, participant.win,
          `${participant.kills}/${participant.deaths}/${participant.assists}`,
          price, match.info.gameDuration,
          participant.totalMinionsKilled + participant.neutralMinionsKilled,
        );

        // Resolve pending bets against this match result
        try {
          const resolved = await resolveBets(matchId, participant.win);
          if (resolved > 0) console.log(`[Poll] Resolved ${resolved} bet(s) for match ${matchId} (${participant.win ? "WIN" : "LOSS"})`);
        } catch (err: any) {
          result.errors.push(`Bet resolution error: ${err.message}`);
        }
      } catch (err: any) {
        result.errors.push(`Match process error ${matchId}: ${err.message}`);
      }
    }

    // Fallback game-end event: if new non-remake matches were found but no
    // spectator-based event was emitted (e.g., spectator API missed the game
    // start), generate the banner from price history instead.
    const existingEvent = cache.get<GameEndEvent>("player.gameEndEvent");
    if (result.newMatches > 0 && !existingEvent) {
      // Get the second-to-last snapshot (the one before this poll added the current one)
      const recentSnapshots = await getPriceHistory(Date.now() - 4 * 60 * 60 * 1000);
      // Find the last snapshot that has different LP from current (i.e., the pre-game state)
      const preGameSnap = [...recentSnapshots].reverse().find(s => s.totalLP !== totalLP);

      if (preGameSnap) {
        const prevLp = preGameSnap.lp;
        const prevTotalLP = preGameSnap.totalLP;
        const prevTier = preGameSnap.tier;
        const prevDivision = preGameSnap.division;
        const prevPriceVal = parseFloat(preGameSnap.price);

        const lpDelta = totalLP - prevTotalLP;
        const priceChangeVal = price - prevPriceVal;
        const priceChangePctVal = prevPriceVal > 0 ? (priceChangeVal / prevPriceVal) * 100 : 0;

        // Get the actual match result from the most recently processed match
        const recentDBMatches = await getRecentMatchesFromDB(1);
        const lastMatchWin = recentDBMatches.length > 0 ? recentDBMatches[0].win : undefined;

        const fallbackEvent: GameEndEvent = {
          lpBefore: prevLp,
          lpAfter: lp,
          lpDelta,
          tierBefore: prevTier,
          divisionBefore: prevDivision,
          tierAfter: tier,
          divisionAfter: division,
          priceBefore: prevPriceVal,
          priceAfter: price,
          priceChange: priceChangeVal,
          priceChangePct: priceChangePctVal,
          timestamp: Date.now(),
          win: lastMatchWin !== undefined ? Boolean(lastMatchWin) : undefined,
        };

        cache.set("player.gameEndEvent", fallbackEvent, 10 * 60 * 1000);
        console.log(`[Poll] Game END event (fallback from match): LP ${prevLp} → ${lp} (${lpDelta >= 0 ? "+" : ""}${lpDelta}), Price $${prevPriceVal.toFixed(2)} → $${price.toFixed(2)}`);

        // Discord notification
        notifyGameEnd(lpDelta, prevPriceVal, price).catch(() => {});
      }
    }

    // Discord notifications — only fire when new matches are detected (not every poll)
    if (result.newMatches > 0) {
      // Rank change: only notify if rank actually changed with this batch of matches
      if (previousTier !== null && previousDivision !== null) {
        if (tier !== previousTier || division !== previousDivision) {
          const prevTotalLPVal = tierToTotalLP(previousTier, previousDivision, 0);
          const currTotalLPVal = tierToTotalLP(tier, division, 0);
          notifyRankChange(previousTier, previousDivision, tier, division, currTotalLPVal > prevTotalLPVal).catch(() => {});
        }
      }

      // Streak: only notify if streak count increased (not same streak re-detected)
      try {
        const recentForStreak = await getRecentMatchesFromDB(10);
        const nonRemakes = recentForStreak.filter(m => !m.isRemake);
        if (nonRemakes.length >= 3) {
          const firstResult = nonRemakes[0].win;
          let streakCount = 0;
          for (const m of nonRemakes) {
            if (m.win === firstResult) streakCount++;
            else break;
          }
          if (streakCount >= 3 && streakCount > lastNotifiedStreakCount) {
            notifyStreak(firstResult ? "win" : "loss", streakCount).catch(() => {});
            lastNotifiedStreakCount = streakCount;
          } else if (streakCount < 3) {
            lastNotifiedStreakCount = 0; // Reset when streak breaks
          }
        }
      } catch { /* non-critical */ }

      // Big price move: only notify once per match batch
      if (prevPrice > 0) {
        const pricePctChange = Math.abs((price - prevPrice) / prevPrice) * 100;
        if (pricePctChange >= 5) {
          notifyBigPriceMove("DORI", prevPrice, price).catch(() => {});
        }
      }
    }
    previousTier = tier;
    previousDivision = division;

    // Prefetch price history (reused for daily summary + order execution)
    let fullHistoryCache: Awaited<ReturnType<typeof getPriceHistory>> | null = null;

    // Discord: daily summary (once per day, after 10 PM KST / 6 AM PT)
    const nowDate = new Date();
    const todayKey = `${nowDate.getFullYear()}-${nowDate.getMonth()}-${nowDate.getDate()}`;
    const hourUTC = nowDate.getUTCHours();
    // Send at ~1 PM UTC (10 PM KST / 6 AM PT)
    if (hourUTC >= 13 && lastDailySummaryDate !== todayKey) {
      try {
        const { users: allUsers, holdingsByUser } = await getLeaderboard();
        const fullHist = fullHistoryCache ?? await getPriceHistory();
        if (!fullHistoryCache) fullHistoryCache = fullHist;
        const etfPrices = fullHist.length > 0 ? computeAllETFPricesSync(fullHist) : { DORI: price };

        const rankings = allUsers.map(u => {
          const cash = u.cashBalance ? parseFloat(u.cashBalance) : 200;
          const userHoldings = holdingsByUser.get(u.userId) ?? [];
          let holdVal = 0, shortPnl = 0;
          for (const h of userHoldings) {
            const p = (etfPrices as Record<string, number>)[h.ticker] || 0;
            holdVal += parseFloat(h.shares) * p;
            shortPnl += parseFloat(h.shortShares) * (parseFloat(h.shortAvgPrice) - p);
          }
          return { name: String(u.userName || "Unknown"), value: cash + holdVal + shortPnl };
        }).sort((a, b) => b.value - a.value);

        await notifyDailySummary(tier, division, lp, price, wins, losses, rankings);
        lastDailySummaryDate = todayKey;
        await saveLastDailySummaryDate(todayKey);
        console.log("[Poll] Daily summary sent to Discord");

        // Daily cleanup: prune old price history + portfolio snapshots
        await pruneOldPriceHistory();
        await pruneOldPortfolioSnapshots();
        await pruneOldPortfolioSnapshots();
      } catch (err: any) {
        console.warn("[Poll] Daily summary failed:", err?.message);
      }
    }

    // 6. Execute pending orders
    // Compute ETF prices from full history (fetched once, reused for orders + snapshots)
    const fullHistory = fullHistoryCache ?? await getPriceHistory();
    const currentETFPrices = fullHistory.length > 0
      ? computeAllETFPricesSync(fullHistory)
      : { DORI: price, DDRI: price, TDRI: price, SDRI: price, XDRI: price };

    const pendingOrders = await getPendingOrders();
    for (const order of pendingOrders) {
      const orderTicker = order.ticker;
      const orderPrice = parseFloat(order.targetPrice);
      const orderShares = parseFloat(order.shares);

      // Get current ETF price from unified computation
      const etfPrice = currentETFPrices[orderTicker as keyof typeof currentETFPrices] || price;

      let shouldExecute = false;
      if (order.orderType === "limit_buy" && etfPrice <= orderPrice) shouldExecute = true;
      if (order.orderType === "limit_sell" && etfPrice >= orderPrice) shouldExecute = true;
      if (order.orderType === "stop_loss" && etfPrice <= orderPrice) shouldExecute = true;

      if (shouldExecute) {
        try {
          if (order.orderType === "limit_buy") {
            await executeTrade(order.userId, orderTicker, "buy", orderShares, etfPrice);
          } else {
            await executeTrade(order.userId, orderTicker, "sell", orderShares, etfPrice);
          }
          await fillOrder(order.id, etfPrice);
          result.ordersExecuted++;

          // Create notification for order fill
          const notifType = order.orderType === "stop_loss" ? "stop_loss_triggered" as const : "order_filled" as const;
          const orderLabel = order.orderType === "limit_buy" ? "Limit Buy" : order.orderType === "limit_sell" ? "Limit Sell" : "Stop-Loss";
          await createNotification({
            userId: order.userId,
            type: notifType,
            title: `${orderLabel} Filled: $${orderTicker}`,
            message: `Your ${orderLabel.toLowerCase()} order for ${orderShares.toFixed(2)} shares of $${orderTicker} was filled at $${etfPrice.toFixed(2)}.`,
            relatedId: order.id,
          });
        } catch (err: any) {
          result.errors.push(`Order ${order.id} execution error: ${err.message}`);
        }
      }
    }

    // 6b. Check price alerts
    try {
      const client = (await import("./db")).getRawClient();
      const alerts = await client.execute(`SELECT * FROM price_alerts WHERE triggered = 0`);
      for (const alert of alerts.rows as any[]) {
        const alertPrice = parseFloat(String(alert.targetPrice));
        const etfPrice = currentETFPrices[alert.ticker as keyof typeof currentETFPrices] || price;
        const shouldTrigger = (alert.direction === "above" && etfPrice >= alertPrice) ||
                             (alert.direction === "below" && etfPrice <= alertPrice);
        if (shouldTrigger) {
          await client.execute({ sql: `UPDATE price_alerts SET triggered = 1 WHERE id = ?`, args: [alert.id] });
          await createNotification({
            userId: Number(alert.userId),
            type: "system",
            title: `Price Alert: $${alert.ticker}`,
            message: `$${alert.ticker} ${alert.direction === "above" ? "reached" : "dropped to"} $${etfPrice.toFixed(2)} (target: $${alertPrice.toFixed(2)})`,
          });
        }
      }
    } catch { /* price_alerts table may not exist yet */ }

    // 7. Record portfolio snapshots for P&L charting
    try {
      const nowMs = Date.now();
      if (nowMs - lastPortfolioSnapshotTime >= PORTFOLIO_SNAPSHOT_INTERVAL_MS) {
        await recordPortfolioSnapshots(currentETFPrices as Record<string, number>);
        lastPortfolioSnapshotTime = nowMs;
      }
    } catch (err: any) {
      result.errors.push(`Portfolio snapshot error: ${err.message}`);
    }

    // 8. Run AI bot trader (every cycle, only during live games)
    try {
      const botTraded = await runBotTrader();
      if (botTraded) {
        console.log("[Poll] Bot trader executed a trade");
      }
    } catch (err: any) {
      result.errors.push(`Bot trader error: ${err.message}`);
      console.error("[Poll] Bot trader error:", err);
    }

    // 9. Update market status based on recent activity
    if (result.newMatches > 0 || confirmedIsInGame) {
      await setMarketStatus(true, "Player recently active in ranked");
    } else {
      await setMarketStatus(true, "Market open — awaiting next game");
    }

  } catch (err: any) {
    result.errors.push(`Poll error: ${err.message}`);
    console.error("[Poll] Error:", err);
  } finally {
    isPolling = false;
    lastPollTime = new Date();
    lastPollResult = result;
    // Invalidate all server-side caches after poll writes new data
    // Preserve game-end event before clearing (10-min TTL for frontend to poll)
    const savedGameEndEvent = cache.get<GameEndEvent>("player.gameEndEvent");
    cache.invalidateAll();
    // Re-set confirmed live game status so trade blocking persists between polls
    cache.set("player.liveGame.check", confirmedIsInGame, 45_000);
    // Re-set game-end event if it exists (survives cache clear)
    if (savedGameEndEvent) {
      cache.set("player.gameEndEvent", savedGameEndEvent, 10 * 60 * 1000);
    }
    console.log(`[Poll] Complete. Price: $${result.price.toFixed(2)}, New matches: ${result.newMatches}, News: ${result.newsGenerated}, Dividends: ${result.dividendsPaid}, Orders: ${result.ordersExecuted}`);
  }

  return result;
}

/**
 * Generate a meme news headline using LLM
 */
async function generateMemeNews(
  champion: string, win: boolean, kills: number, deaths: number, assists: number,
  currentPrice: number, previousPrice: number, cs: number, gameDuration: number,
  position: string
): Promise<{ headline: string; body: string } | null> {
  const priceChange = currentPrice - previousPrice;
  const pctChange = previousPrice > 0 ? ((priceChange / previousPrice) * 100).toFixed(1) : "0";
  const kda = `${kills}/${deaths}/${assists}`;
  const minutes = Math.floor(gameDuration / 60);

  const prompt = `You are a financial news writer for a meme stock trading platform. The stock $DORI tracks a League of Legends player named "목도리 도마뱀" (dori).

Generate ONE extremely funny, memey financial news headline and a short body (2-3 sentences) about this match result:

- Champion: ${champion}
- Result: ${win ? "WIN" : "LOSS"}
- KDA: ${kda}
- CS: ${cs}
- Position: ${position}
- Game Duration: ${minutes} minutes
- Stock Price: $${currentPrice.toFixed(2)} (${priceChange >= 0 ? "+" : ""}${pctChange}%)

Rules:
- Write like a Bloomberg/CNBC headline but make it absurdly funny
- Reference the champion, KDA, and result
- Use financial jargon mixed with League of Legends terms
- If it's a loss with many deaths, be extra dramatic (market crash, SEC investigation, etc.)
- If it's a win, be overly bullish (moon, rocket, institutional investors, etc.)
- If KDA is terrible (like 0/10), make it catastrophic news
- If KDA is great, make it sound like the greatest trade ever
- Keep the headline under 120 characters
- Keep the body under 200 characters
- Be creative, sarcastic, and hilarious

Respond in JSON format: { "headline": "...", "body": "..." }`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a comedic financial news AI. Always respond with valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "news_article",
          strict: true,
          schema: {
            type: "object",
            properties: {
              headline: { type: "string", description: "Funny financial news headline" },
              body: { type: "string", description: "Short funny news body" },
            },
            required: ["headline", "body"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (content && typeof content === 'string') {
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("[News] LLM generation failed:", err);
  }

  // Fallback: situation-aware WSB-style templates
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const isFeeding = deaths >= 8;
  const isCarry = kills >= 10 && deaths <= 3;
  const isPerfect = deaths === 0 && kills >= 5;
  const isInter = deaths >= 10;
  const isUseless = kills === 0 && assists <= 2;
  const isLongGame = minutes >= 35;
  const isFF = minutes <= 20;
  const isHighKP = (kills + assists) >= 20;

  let headlines: string[];
  let bodies: string[];

  if (win && isPerfect) {
    headlines = [
      `$DORI TO THE MOON: CEO goes DEATHLESS ${kda} on ${champion}. Hedgies in shambles.`,
      `BREAKING: $DORI CEO achieves perfection. ${kda} ${champion}. Shorts liquidated.`,
      `$DORI GAMMA SQUEEZE IMMINENT after ${champion} ${kda} flawless game. Diamond hands rewarded.`,
      `SEC halts trading on $DORI after CEO's ${kda} ${champion} is "too good to be real"`,
      `$DORI hits all-time high. CEO ${kda} on ${champion}. Cathie Wood seen buying.`,
      `URGENT: $DORI bears found dead in ditch after ${champion} ${kda} perfection`,
    ];
    bodies = [
      `Zero deaths. ${kills} kills. This is what peak performance looks like. Every short seller is currently on the phone with their therapist.`,
      `Institutional investors are scrambling to increase positions after this flawless ${champion} performance. "I've never seen anything like it," says Goldman analyst.`,
      `Reddit's r/wallstreetbets unanimously declares $DORI "the play of the century" after CEO's untouchable ${champion} game.`,
    ];
  } else if (win && isCarry) {
    headlines = [
      `$DORI surges ${pctChange}% as CEO 1v9s on ${champion}. ${kda}. Absolutely disgusting.`,
      `BREAKING: $DORI CEO goes nuclear on ${champion}. ${kda}. Bears in body bags.`,
      `$DORI prints tendies after CEO's ${kda} ${champion} carry. Wife's boyfriend impressed.`,
      `$DORI stock breaks resistance after ${champion} ${kda} hard carry. Apes together strong.`,
      `Citadel scrambles to cover $DORI shorts after CEO's ${kda} ${champion} performance`,
      `$DORI bull thesis confirmed: CEO smurfs on ${champion} with ${kda}. Not financial advice btw.`,
      `ALERT: $DORI CEO just ${kda}'d the entire enemy team on ${champion}. We're all gonna make it.`,
    ];
    bodies = [
      `CEO went absolutely feral on ${champion} — ${kills} kills in ${minutes} minutes. Short interest just evaporated. This stock is the future.`,
      `"This is the greatest trade I've ever seen," says retail investor who bought at the top. ${kda} on ${champion}. Gains are gains.`,
      `Wall Street analysts upgrading $DORI from "Overweight" to "BUY EVERYTHING" after this ${champion} masterclass.`,
    ];
  } else if (win && isHighKP) {
    headlines = [
      `$DORI rallies as CEO participates in ${kills + assists} kills on ${champion}. Team player energy.`,
      `$DORI green candle: CEO's ${kda} ${champion} shows "strong fundamentals"`,
      `Bullish on $DORI: CEO goes ${kda} on ${champion}. Jim Cramer in shambles.`,
    ];
    bodies = [
      `High kill participation on ${champion} shows CEO is "locked in." Portfolio managers taking notice. ${kda} in ${minutes} minutes.`,
      `CEO's ${champion} game was what analysts call "fundamentally sound." ${kda}. Buying pressure intensifies.`,
    ];
  } else if (win) {
    headlines = [
      `$DORI closes green: ${champion} ${kda} dub. Not a lot but it's honest work.`,
      `$DORI edges up ${pctChange}% after CEO secures the W on ${champion}. ${kda}.`,
      `$DORI bulls eating good tonight. CEO ${kda} on ${champion}. Steak's on me.`,
      `$DORI quarterly earnings beat expectations: CEO's ${champion} ${kda} delivers shareholder value.`,
      `$DORI wins again. ${champion} ${kda}. At this point shorts are just donating money.`,
      `$DORI CEO brings home the dub on ${champion}. ${kda}. Slow and steady wins the race. JK GO FAST.`,
      `Another day another $DORI W. ${champion} ${kda}. We literally can't stop winning.`,
      `$DORI: "We see continued momentum." CEO goes ${kda} on ${champion}. Stock up ${pctChange}%.`,
    ];
    bodies = [
      `A solid ${kda} on ${champion} in ${minutes} minutes. Nothing fancy, just consistent alpha generation. This is what the DD predicted.`,
      `CEO's ${champion} win adds to $DORI's bullish thesis. ${kda}. Accumulation zone identified.`,
      `$DORI shareholders remain cautiously optimistic after a ${kda} ${champion} victory. Tendies loading...`,
    ];
  } else if (isInter) {
    headlines = [
      `CIRCUIT BREAKER: $DORI halted after CEO speedruns ${deaths} deaths on ${champion}. ${kda}.`,
      `$DORI -${pctChange.replace("-", "")}%: CEO goes ${kda} on ${champion}. Straight to jail.`,
      `BREAKING: $DORI CEO under investigation for potential match fixing. ${kda} on ${champion}.`,
      `$DORI flash crash: CEO runs it down ${deaths} times on ${champion}. Bagholders in tears.`,
      `$DORI shareholders file class action after CEO's ${kda} ${champion} game. "This was intentional."`,
      `MAYDAY MAYDAY: $DORI CEO ${kda} on ${champion}. This is not a drill. Sell everything.`,
      `$DORI CEO ${kda} on ${champion}. NYSE considering permanent delisting.`,
      `AMBER ALERT: $DORI CEO's dignity last seen before ${kda} ${champion} game`,
    ];
    bodies = [
      `${deaths} deaths in ${minutes} minutes on ${champion}. Congress is scheduling hearings. Nancy Pelosi seen panic selling. This is the worst day in $DORI history.`,
      `CEO's ${kda} performance on ${champion} has triggered every stop-loss in existence. Margin calls going out as we speak. GG FF at 15.`,
      `"I've never seen anything this bad," says veteran analyst. ${kda} on ${champion}. Even the bots are selling.`,
    ];
  } else if (isFeeding) {
    headlines = [
      `$DORI tumbles as CEO goes ${kda} on ${champion}. Wendy's applications open.`,
      `$DORI bears feast: CEO's ${kda} ${champion} game is "concerning" say analysts.`,
      `$DORI red day: ${champion} ${kda}. CEO's mom calling to ask if they're okay.`,
      `SELL RATING: $DORI CEO goes ${kda} on ${champion}. "We've seen enough." - JP Morgan`,
      `$DORI dips after CEO feeds ${deaths} kills on ${champion}. Loss porn incoming.`,
      `$DORI CEO's ${kda} ${champion} game classified as a "humanitarian crisis" by the UN`,
    ];
    bodies = [
      `${deaths} deaths on ${champion} in ${minutes} minutes. Analysts downgrading from "Buy" to "Have you considered index funds?"`,
      `CEO's ${champion} performance triggered 47 stop-losses. Short sellers sending thank you cards. ${kda}.`,
      `"I am once again asking for my money back," says every $DORI investor after ${kda} on ${champion}.`,
    ];
  } else if (!win && isUseless) {
    headlines = [
      `$DORI slumps: CEO goes AFK mentally on ${champion}. ${kda}. Did they even play?`,
      `$DORI CEO ${kda} on ${champion}. Sources say they were watching Netflix the whole time.`,
      `$DORI underperforms: CEO's ${kda} ${champion} was "uninspiring" — Goldman Sachs`,
      `$DORI CEO achieves nothing on ${champion}. ${kda}. Shareholders demand drug test.`,
    ];
    bodies = [
      `${kda} on ${champion} in ${minutes} minutes. CEO reportedly alt-tabbed to check $DORI stock price mid-game. It did not help.`,
      `Zero impact detected. CEO's ${champion} was invisible. ${kda}. The team forgot they had a 5th player.`,
    ];
  } else if (!win && isFF) {
    headlines = [
      `BREAKING: $DORI speedrun collapse. ${champion} ${kda}. Game over in ${minutes} min. FF@15.`,
      `$DORI implodes in record time: CEO's ${champion} goes ${kda}. Fastest L in history.`,
      `$DORI flash crash: ${minutes}-minute ${champion} loss. ${kda}. "Not even close" — no one.`,
      `$DORI CEO surrenders at ${minutes} min on ${champion}. ${kda}. White flag energy.`,
    ];
    bodies = [
      `Game lasted ${minutes} minutes. That's less time than it takes to microwave a Hot Pocket. ${kda} on ${champion}. Down bad.`,
      `CEO's ${champion} game ended so fast the price chart looks like a cliff. ${kda}. Early FF = early bed.`,
    ];
  } else if (!win && isLongGame) {
    headlines = [
      `$DORI bleeds for ${minutes} min before dying: CEO ${kda} on ${champion}. Slow painful death.`,
      `$DORI CEO edged shareholders for ${minutes} minutes then lost. ${champion} ${kda}. Emotional damage.`,
      `BREAKING: $DORI CEO wastes ${minutes} minutes of everyone's life on ${champion}. ${kda}.`,
    ];
    bodies = [
      `${minutes} minutes of hope, all for nothing. ${kda} on ${champion}. This is what diamond handing a -99% position feels like.`,
      `CEO fought for ${minutes} minutes on ${champion} — ${kda} — but in the end, the market always wins. And today the market was the enemy nexus.`,
    ];
  } else {
    headlines = [
      `$DORI dips: CEO ${kda} on ${champion}. Not great, not terrible. Actually pretty terrible.`,
      `$DORI closes red after ${champion} ${kda} loss. Tomorrow's another day. Probably red too.`,
      `$DORI CEO goes ${kda} on ${champion}. Stock drops. Sun rises. Water is wet.`,
      `$DORI L: ${champion} ${kda}. CEO asks "is this the bottom?" Narrator: it was not the bottom.`,
      `$DORI takes the L. ${champion} ${kda}. "I'll make it back tomorrow" - CEO (every day)`,
      `$DORI down ${pctChange}%. CEO's ${kda} ${champion} blamed. Thoughts and prayers for holders.`,
      `$DORI CEO ${kda} on ${champion}. Loss. The chart is starting to look like my credit score.`,
      `Rough day for $DORI: ${champion} ${kda}. CEO says "just a dip." Portfolio says otherwise.`,
    ];
    bodies = [
      `Another loss on ${champion}. ${kda} in ${minutes} minutes. $DORI holders switching to crypto. Wait, that's worse.`,
      `CEO's ${champion} game disappointed investors. ${kda}. Time to reassess the bull thesis. Or cope. Probably cope.`,
      `${kda} on ${champion}. Not the worst we've seen. But definitely not what the prospectus promised.`,
    ];
  }

  const headline = pick(headlines);
  const body = pick(bodies);
  return { headline, body };
}

/**
 * Start the polling loop
 */
export function startPolling() {
  if (pollTimer) {
    console.log("[Poll] Already running");
    return;
  }

  console.log(`[Poll] Starting polling every ${POLL_INTERVAL_MS / 1000}s`);
  console.log(`[Poll] Discord notifications: ${isDiscordConfigured() ? "enabled" : "disabled (set DISCORD_BOT_TOKEN + DISCORD_CHANNEL_ID)"}`);

  // Load persisted daily summary date to prevent duplicate sends after restart
  loadLastDailySummaryDate().catch(() => {});

  // Small delay before first poll to ensure DB is ready (migrations may still be settling)
  setTimeout(() => {
    pollNow().catch(err => console.error("[Poll] Initial poll failed:", err));
  }, 3000);

  // Then every 2 minutes
  pollTimer = setInterval(() => {
    pollNow().catch(err => console.error("[Poll] Scheduled poll failed:", err));
  }, POLL_INTERVAL_MS);
}

/**
 * Stop the polling loop
 */
export function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log("[Poll] Stopped");
  }
}

/**
 * Get polling status
 */
export function getPollStatus() {
  return {
    isRunning: !!pollTimer,
    isPolling,
    lastPollTime,
    lastPollResult,
  };
}
