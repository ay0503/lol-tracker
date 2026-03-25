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
  getPriceHistory,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { computeAllETFPricesSync, TICKERS as ETF_TICKERS } from "./etfPricing";
import { runBotTrader, ensureBotUser } from "./botTrader";
import { notifyGameStart, notifyGameEnd, notifyNewMatch, isDiscordConfigured } from "./discord";

// Player config
const GAME_NAME = "목도리 도마뱀";
const TAG_LINE = "dori";
const PUUID_CACHE: { puuid?: string } = {};

// Polling interval (2 minutes)
const POLL_INTERVAL_MS = 2 * 60 * 1000;

let pollTimer: NodeJS.Timeout | null = null;
let isPolling = false;
let lastPollTime: Date | null = null;
let lastPollResult: PollResult | null = null;

// Two-consecutive-confirmation for live game detection.
// The confirmed status only flips when two consecutive raw checks agree.
// This prevents false toggles from API flickers and provides a ~2 min delay.
let previousRawIsInGame: boolean | null = null; // raw result from last poll
let confirmedIsInGame = false; // only changes after 2 consecutive agreeing polls

// Pre-game snapshot for post-game LP notification banner
let preGameSnapshot: {
  lp: number;
  tier: string;
  division: string;
  totalLP: number;
  price: number;
  timestamp: number;
} | null = null;

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
    // 1. Check live game status with two-consecutive-confirmation
    // The confirmed status only flips when two consecutive raw checks agree.
    // This prevents false toggles and provides a natural ~2 min delay.
    console.log("[Poll] Checking live game status...");
    let rawIsInGame = false;
    let playerDataForGame: Awaited<ReturnType<typeof fetchFullPlayerData>> | null = null;
    try {
      playerDataForGame = await fetchFullPlayerData(GAME_NAME, TAG_LINE);
      PUUID_CACHE.puuid = playerDataForGame.account.puuid;
      const activeGame = await getActiveGame(playerDataForGame.account.puuid);
      rawIsInGame = !!activeGame && activeGame.gameQueueConfigId === 420;
    } catch (err: any) {
      console.warn("[Poll] Live game check failed:", err?.message);
      // On error, preserve previous state to avoid false game-end detection
      rawIsInGame = previousRawIsInGame ?? false;
    }

    // Two-consecutive-confirmation logic
    const wasConfirmedInGame = confirmedIsInGame;
    if (previousRawIsInGame !== null && rawIsInGame === previousRawIsInGame && rawIsInGame !== confirmedIsInGame) {
      // Two consecutive polls agree on a NEW status — flip confirmed
      confirmedIsInGame = rawIsInGame;
      console.log(`[Poll] Live game CONFIRMED: ${confirmedIsInGame ? "IN GAME" : "not in game"} (after 2 consecutive checks)`);
    } else if (rawIsInGame !== previousRawIsInGame) {
      console.log(`[Poll] Live game raw: ${rawIsInGame ? "IN GAME" : "not in game"} (waiting for confirmation, confirmed: ${confirmedIsInGame ? "IN GAME" : "not in game"})`);
    } else {
      console.log(`[Poll] Live game: confirmed=${confirmedIsInGame ? "IN GAME" : "not in game"}, raw=${rawIsInGame ? "IN GAME" : "not in game"}`);
    }
    previousRawIsInGame = rawIsInGame;

    // Track game-start: capture pre-game LP/price snapshot
    // Reuse playerDataForGame from the live-game check above to avoid a duplicate API call
    if (!wasConfirmedInGame && confirmedIsInGame && playerDataForGame) {
      try {
        const snapEntry = playerDataForGame.soloEntry;
        if (snapEntry) {
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
        }

        // Discord notification for game start
        try {
          const activeGame = await getActiveGame(playerDataForGame.account.puuid);
          const participant = activeGame?.participants.find(p => p.puuid === playerDataForGame.account.puuid);
          const queueNames: Record<number, string> = { 420: "Ranked Solo/Duo", 440: "Ranked Flex", 400: "Normal Draft", 450: "ARAM" };
          const gameMode = activeGame ? queueNames[activeGame.gameQueueConfigId] ?? "Unknown" : undefined;
          notifyGameStart(participant?.championId ? `ID ${participant.championId}` : undefined, gameMode);
        } catch { /* non-critical */ }
      } catch (err: any) {
        console.warn("[Poll] Failed to capture pre-game snapshot:", err?.message);
      }
    }

    // Update the cache with the CONFIRMED status (used by trade endpoints + bot)
    cache.set("player.liveGame.check", confirmedIsInGame, 150_000); // 2.5 min TTL

    // 2. Fetch current player data
    console.log("[Poll] Fetching player data...");
    const playerData = await fetchFullPlayerData(GAME_NAME, TAG_LINE);
    PUUID_CACHE.puuid = playerData.account.puuid;

    if (!playerData.soloEntry) {
      result.errors.push("No solo/duo ranked data found");
      return result;
    }

    const { tier, rank: division, leaguePoints: lp, wins, losses } = playerData.soloEntry;
    const totalLP = tierToTotalLP(tier, division, lp);
    const price = tierToPrice(tier, division, lp);

    // Emit game-end event now that we have current LP/price
    if (wasConfirmedInGame && !confirmedIsInGame && preGameSnapshot) {
      // Use totalLP (absolute LP across all tiers) for accurate delta calculation
      // Raw LP difference is wrong when tier/division changes (e.g., Emerald 2 10LP -> Emerald 3 96LP = -14 LP, not +86)
      const lpDelta = totalLP - preGameSnapshot.totalLP;
      const priceChange = price - preGameSnapshot.price;
      const priceChangePct = preGameSnapshot.price > 0
        ? (priceChange / preGameSnapshot.price) * 100
        : 0;

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
      notifyGameEnd(lpDelta, preGameSnapshot.price, price);

      // Clear pre-game snapshot
      preGameSnapshot = null;
    }

    result.price = price;
    result.tier = tier;
    result.division = division;
    result.lp = lp;
    result.wins = wins;
    result.losses = losses;

    // 2. Store price snapshot
    console.log(`[Poll] Price: $${price.toFixed(2)} (${tier} ${division} ${lp}LP)`);
    await addPriceSnapshot({ timestamp: Date.now(), tier, division, lp, totalLP, price, wins, losses });

    // 3. Fetch and process new matches
    // First get match IDs, filter out already-processed ones, then only fetch details for new ones
    console.log("[Poll] Fetching recent match IDs...");
    const puuid = playerData.account.puuid;
    const recentMatchIds = await getMatchIds(puuid, 10, 420);
    const processedIds = await getProcessedMatchIds();
    const newMatchIds = recentMatchIds.filter(id => !processedIds.has(id));

    console.log(`[Poll] ${newMatchIds.length} new matches to process (${recentMatchIds.length - newMatchIds.length} already processed)`);

    const previousPrice = await getLatestPrice();
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

        // Skip news generation and dividends for remakes
        if (isRemake) {
          console.log(`[Poll] Skipping news/dividends for remake match ${matchId}`);
          continue;
        }

        // 4. Distribute dividends (DISABLED — kept for easy re-enable)
        // try {
        //   const reason = participant.win
        //     ? `Win on ${participant.championName} (${participant.kills}/${participant.deaths}/${participant.assists})`
        //     : `Loss on ${participant.championName} (${participant.kills}/${participant.deaths}/${participant.assists})`;
        //
        //   await distributeDividends(matchId, participant.win, reason);
        //   await markMatchDividendsPaid(matchId);
        //   result.dividendsPaid++;
        // } catch (err: any) {
        //   result.errors.push(`Dividend error for ${matchId}: ${err.message}`);
        // }

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
      } catch (err: any) {
        result.errors.push(`Match process error ${matchId}: ${err.message}`);
      }
    }

    // 6. Execute pending orders
    // Compute ETF prices from full history (unified compounding)
    console.log("[Poll] Computing ETF prices from full history...");
    const fullHistory = await getPriceHistory();
    const currentETFPrices = fullHistory.length > 0
      ? computeAllETFPricesSync(fullHistory)
      : { DORI: price, DDRI: price, TDRI: price, SDRI: price, XDRI: price };

    console.log("[Poll] Checking pending orders...");
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

    // 7. Record portfolio snapshots for P&L charting
    try {
      await recordPortfolioSnapshots(currentETFPrices as Record<string, number>);
      console.log("[Poll] Portfolio snapshots recorded");
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
    cache.set("player.liveGame.check", confirmedIsInGame, 150_000);
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

  // Fallback: generate a simple headline without LLM
  const fallbackHeadlines = win
    ? [
        `BREAKING: $DORI rallies ${pctChange}% after ${champion} ${kda} victory`,
        `$DORI bulls rejoice as CEO goes ${kda} on ${champion}, stock surges`,
        `Analysts upgrade $DORI to "Strong Buy" after ${champion} carry performance`,
      ]
    : [
        `MARKET CRASH: $DORI plunges after CEO goes ${kda} on ${champion}`,
        `$DORI shareholders in shambles as ${champion} performance disappoints`,
        `SEC investigating $DORI after suspicious ${kda} ${champion} game`,
      ];

  const headline = fallbackHeadlines[Math.floor(Math.random() * fallbackHeadlines.length)];
  const body = win
    ? `Investors celebrate as $DORI CEO delivers a ${kda} performance on ${champion} in ${minutes} minutes. Institutional buying intensifies.`
    : `$DORI stock tumbles after CEO's ${kda} ${champion} game lasting ${minutes} minutes. Short sellers rejoice.`;

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

  console.log(`[Poll] Starting polling every ${POLL_INTERVAL_MS / 1000 / 60} minutes`);
  console.log(`[Poll] Discord notifications: ${isDiscordConfigured() ? "enabled" : "disabled (set DISCORD_BOT_TOKEN + DISCORD_CHANNEL_ID)"}`);

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
