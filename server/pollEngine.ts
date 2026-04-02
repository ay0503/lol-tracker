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

// Champion ID → Name mapping (Riot Data Dragon)
const CHAMPION_NAMES: Record<number, string> = {
  1:"Annie",2:"Olaf",3:"Galio",4:"TwistedFate",5:"XinZhao",6:"Urgot",7:"LeBlanc",8:"Vladimir",9:"Fiddlesticks",10:"Kayle",
  11:"Master Yi",12:"Ryze",13:"Amumu",14:"Sion",15:"Sivir",16:"Soraka",17:"Teemo",18:"Tristana",19:"Warwick",20:"Nunu",
  21:"Miss Fortune",22:"Ashe",23:"Tryndamere",24:"Jax",25:"Morgana",26:"Ziggs",27:"Singed",28:"Evelynn",29:"Twitch",30:"Karthus",
  31:"Cho'Gath",32:"Heimerdinger",33:"Mordekaiser",34:"Kassadin",35:"Shaco",36:"Dr. Mundo",37:"Sona",38:"Irelia",39:"Jhin",40:"Janna",
  41:"Gangplank",42:"Corki",43:"Karma",44:"Taric",45:"Veigar",48:"Trundle",50:"Swain",51:"Caitlyn",53:"Blitzcrank",54:"Malphite",
  55:"Katarina",56:"Nocturne",57:"Maokai",58:"Renekton",59:"Jarvan IV",60:"Elise",61:"Orianna",62:"Wukong",63:"Brand",64:"Lee Sin",
  67:"Vayne",68:"Rumble",69:"Cassiopeia",72:"Skarner",74:"Heimerdinger",75:"Nasus",76:"Nidalee",77:"Udyr",78:"Poppy",79:"Gragas",
  80:"Pantheon",81:"Ezreal",82:"Mordekaiser",83:"Yorick",84:"Akali",85:"Kennen",86:"Garen",89:"Leona",90:"Malzahar",91:"Talon",
  92:"Riven",96:"Kog'Maw",98:"Shen",99:"Lux",101:"Xerath",102:"Shyvana",103:"Ahri",104:"Graves",105:"Fizz",106:"Volibear",
  107:"Rengar",110:"Varus",111:"Nautilus",112:"Viktor",113:"Sejuani",114:"Fiora",115:"Ziggs",117:"Lulu",119:"Draven",120:"Hecarim",
  121:"Kha'Zix",122:"Darius",126:"Jayce",127:"Lissandra",131:"Diana",133:"Quinn",134:"Syndra",136:"Aurelion Sol",141:"Kayn",
  142:"Zoe",143:"Zyra",145:"Kai'Sa",147:"Seraphine",150:"Gnar",154:"Zac",157:"Yasuo",161:"Vel'Koz",163:"Taliyah",
  164:"Camille",166:"Akshan",200:"Bel'Veth",201:"Braum",202:"Jhin",203:"Kindred",221:"Zeri",222:"Jinx",223:"Tahm Kench",
  233:"Briar",234:"Viego",235:"Senna",236:"Lucian",238:"Zed",240:"Kled",245:"Ekko",246:"Qiyana",254:"Vi",266:"Aatrox",
  267:"Nami",268:"Azir",350:"Yuumi",360:"Samira",412:"Thresh",420:"Illaoi",421:"Rek'Sai",427:"Ivern",429:"Kalista",
  432:"Bard",497:"Rakan",498:"Xayah",516:"Ornn",517:"Sylas",518:"Neeko",523:"Aphelios",526:"Rell",555:"Pyke",
  711:"Vex",777:"Yone",875:"Sett",876:"Lillia",887:"Gwen",888:"Renata Glasc",895:"Nilah",897:"K'Sante",901:"Smolder",
  902:"Milio",910:"Hwei",950:"Naafiri",893:"Aurora",170:"Ambessa",
};
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

// Deferred game-end event: when Riot LP API is stale after match, defer until LP updates
let pendingGameEnd: {
  win: boolean | undefined;
  snapshot: { lp: number; tier: string; division: string; totalLP: number; price: number };
  timestamp: number;
} | null = null;

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
        const champName = participant?.championId ? (CHAMPION_NAMES[participant.championId] ?? `Champion ${participant.championId}`) : undefined;
        notifyGameStart(champName, gameMode).catch(() => {});
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
        championName: participant?.championId ? (CHAMPION_NAMES[participant.championId] ?? undefined) : undefined,
        isRanked: true,
      }, 45_000);
    } else if (!confirmedIsInGame) {
      cache.invalidate("player.liveGame.details");
    }

    let { tier, rank: division, leaguePoints: lp, wins, losses } = playerData.soloEntry;
    let totalLP = tierToTotalLP(tier, division, lp);
    let price = tierToPrice(tier, division, lp);

    // Resolve deferred game-end event: LP was stale last poll, check if it updated
    if (pendingGameEnd) {
      const snap = pendingGameEnd.snapshot;
      const lpChanged = totalLP !== snap.totalLP;
      const expired = Date.now() - pendingGameEnd.timestamp > 5 * 60 * 1000;

      if (lpChanged || expired) {
        const lpDelta = totalLP - snap.totalLP;
        const priceChangeVal = price - snap.price;
        const priceChangePctVal = snap.price > 0 ? (priceChangeVal / snap.price) * 100 : 0;
        const winResult = pendingGameEnd.win !== undefined ? pendingGameEnd.win : lpDelta >= 0;

        const gameEndEvent: GameEndEvent = {
          lpBefore: snap.lp, lpAfter: lp, lpDelta,
          tierBefore: snap.tier, divisionBefore: snap.division,
          tierAfter: tier, divisionAfter: division,
          priceBefore: snap.price, priceAfter: price,
          priceChange: priceChangeVal, priceChangePct: priceChangePctVal,
          timestamp: Date.now(), win: pendingGameEnd.win,
        };

        cache.set("player.gameEndEvent", gameEndEvent, 10 * 60 * 1000);
        console.log(`[Poll] Deferred game END resolved: ${winResult ? "WIN" : "LOSS"}, LP ${snap.lp} → ${lp} (${lpDelta >= 0 ? "+" : ""}${lpDelta}), Price $${snap.price.toFixed(2)} → $${price.toFixed(2)}`);
        notifyGameEnd(lpDelta, snap.price, price, pendingGameEnd.win).catch(() => {});
        pendingGameEnd = null;
      }
    }

    // Spectator detected game end — DON'T emit event yet.
    // LP API often lags behind match history, causing wrong win/loss and stale prices.
    // Instead, keep preGameSnapshot alive and emit the event once match data arrives
    // (in the match processing loop below) for accurate win/loss + fresh LP.
    if (wasConfirmedInGame && !confirmedIsInGame && preGameSnapshot) {
      console.log(`[Poll] Spectator says game ended — waiting for match data before emitting event (pre-game: ${preGameSnapshot.tier} ${preGameSnapshot.division} ${preGameSnapshot.lp}LP, $${preGameSnapshot.price.toFixed(2)})`);
    }

    // Expire stale preGameSnapshot if no match data arrived within 2 hours
    if (preGameSnapshot && !confirmedIsInGame && Date.now() - preGameSnapshot.timestamp > 2 * 60 * 60 * 1000) {
      console.log(`[Poll] Clearing stale preGameSnapshot (>2h old, no match data arrived)`);
      preGameSnapshot = null;
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

    // If new matches found, re-fetch LP data for accurate price (Riot LP API can lag behind match history)
    // Retry with delay if LP appears unchanged — Riot API sometimes needs a few seconds to update
    if (newMatchIds.length > 0) {
      const priceBeforeRefresh = price;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          console.log(`[Poll] LP unchanged after match — retry ${attempt}/2 in 5s...`);
          await new Promise(r => setTimeout(r, 5000));
        }
        try {
          const freshData = await fetchFullPlayerData(GAME_NAME, TAG_LINE);
          if (freshData.soloEntry) {
            const freshEntry = freshData.soloEntry;
            const freshPrice = tierToPrice(freshEntry.tier, freshEntry.rank, freshEntry.leaguePoints);
            price = freshPrice;
            result.price = freshPrice;
            result.tier = freshEntry.tier;
            result.division = freshEntry.rank;
            result.lp = freshEntry.leaguePoints;
            // If price changed from initial fetch, LP has updated — stop retrying
            if (Math.abs(freshPrice - priceBeforeRefresh) > 0.005) {
              console.log(`[Poll] LP refresh after match (attempt ${attempt}): $${priceBeforeRefresh.toFixed(2)} → $${freshPrice.toFixed(2)}`);
              break;
            }
          }
        } catch { /* use existing data */ }
      }
      // Update local variables with freshest data for game-end event
      tier = result.tier;
      division = result.division;
      lp = result.lp;
      totalLP = tierToTotalLP(tier, division, lp);

      // Store updated price snapshot if it changed
      if (Math.abs(price - (lastSnapshotPrice ?? 0)) >= 0.005) {
        console.log(`[Poll] Storing refreshed price snapshot: $${price.toFixed(2)} (${tier} ${division} ${lp}LP)`);
        await addPriceSnapshot({ timestamp: Date.now(), tier, division, lp, totalLP, price, wins, losses });
        lastSnapshotPrice = price;
        lastSnapshotTime = Date.now();
      }
    }

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
    let lastMatchWinResult: boolean | undefined;

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

        // Track the latest non-remake match result for game-end event
        if (!isRemake) {
          lastMatchWinResult = participant.win;
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
        let newsHeadline: { headline: string; body: string } | null = null;
        try {
          newsHeadline = await generateMemeNews(
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

        // Discord: notify new match result with news article + game-end banner
        notifyNewMatch(
          participant.championName, participant.win,
          `${participant.kills}/${participant.deaths}/${participant.assists}`,
          price, match.info.gameDuration,
          participant.totalMinionsKilled + participant.neutralMinionsKilled,
          newsHeadline,
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

    // Emit game-end event AFTER match processing so we have authoritative win/loss
    // and fresh LP data. Uses preGameSnapshot if spectator detected game start,
    // otherwise falls back to price history.
    if (result.newMatches > 0) {
      let snapLp: number, snapTotalLP: number, snapTier: string, snapDivision: string, snapPrice: number;

      if (preGameSnapshot) {
        // Spectator path: use the snapshot captured at game start
        snapLp = preGameSnapshot.lp;
        snapTotalLP = preGameSnapshot.totalLP;
        snapTier = preGameSnapshot.tier;
        snapDivision = preGameSnapshot.division;
        snapPrice = preGameSnapshot.price;
        preGameSnapshot = null;
      } else {
        // Fallback: spectator missed game start, reconstruct from price history
        const recentSnapshots = await getPriceHistory(Date.now() - 4 * 60 * 60 * 1000);
        const preGameSnap = [...recentSnapshots].reverse().find(s => s.totalLP !== totalLP);
        if (!preGameSnap) {
          // Can't determine pre-game state, skip event
          snapLp = lp; snapTotalLP = totalLP; snapTier = tier; snapDivision = division; snapPrice = price;
        } else {
          snapLp = preGameSnap.lp;
          snapTotalLP = preGameSnap.totalLP;
          snapTier = preGameSnap.tier;
          snapDivision = preGameSnap.division;
          snapPrice = parseFloat(preGameSnap.price);
        }
      }

      const lpDelta = totalLP - snapTotalLP;

      // If LP hasn't changed after retries, Riot API is lagging — defer event
      if (lpDelta === 0 && lastMatchWinResult !== undefined) {
        console.log(`[Poll] LP unchanged after match (${snapLp}LP → ${lp}LP) — deferring game-end event until Riot LP API updates`);
        pendingGameEnd = {
          win: lastMatchWinResult,
          snapshot: { lp: snapLp, tier: snapTier, division: snapDivision, totalLP: snapTotalLP, price: snapPrice },
          timestamp: Date.now(),
        };
      } else {
        const priceChangeVal = price - snapPrice;
        const priceChangePctVal = snapPrice > 0 ? (priceChangeVal / snapPrice) * 100 : 0;

        // Use actual match result (authoritative), fall back to LP delta
        const winResult = lastMatchWinResult !== undefined ? lastMatchWinResult : lpDelta >= 0;

        const gameEndEvent: GameEndEvent = {
          lpBefore: snapLp,
          lpAfter: lp,
          lpDelta,
          tierBefore: snapTier,
          divisionBefore: snapDivision,
          tierAfter: tier,
          divisionAfter: division,
          priceBefore: snapPrice,
          priceAfter: price,
          priceChange: priceChangeVal,
          priceChangePct: priceChangePctVal,
          timestamp: Date.now(),
          win: lastMatchWinResult,
        };

        cache.set("player.gameEndEvent", gameEndEvent, 10 * 60 * 1000);
        console.log(`[Poll] Game END event: ${winResult ? "WIN" : "LOSS"}, LP ${snapLp} → ${lp} (${lpDelta >= 0 ? "+" : ""}${lpDelta}), Price $${snapPrice.toFixed(2)} → $${price.toFixed(2)}`);

        // Single Discord notification with LP/price info
        notifyGameEnd(lpDelta, snapPrice, price, lastMatchWinResult).catch(() => {});
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

    // 8. AI bot trader — disabled
    // try {
    //   const botTraded = await runBotTrader();
    //   if (botTraded) {
    //     console.log("[Poll] Bot trader executed a trade");
    //   }
    // } catch (err: any) {
    //   result.errors.push(`Bot trader error: ${err.message}`);
    //   console.error("[Poll] Bot trader error:", err);
    // }

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
async function getNewsMode(): Promise<"ai" | "templates"> {
  try {
    const client = getRawClient();
    const result = await client.execute(`SELECT value FROM app_config WHERE key = 'news_mode'`);
    if (result.rows.length > 0) return String(result.rows[0].value) as "ai" | "templates";
  } catch { /* table may not exist */ }
  return "ai"; // default: try AI first, fall back to templates
}

async function generateMemeNews(
  champion: string, win: boolean, kills: number, deaths: number, assists: number,
  currentPrice: number, previousPrice: number, cs: number, gameDuration: number,
  position: string
): Promise<{ headline: string; body: string } | null> {
  const priceChange = currentPrice - previousPrice;
  const pctChange = previousPrice > 0 ? ((priceChange / previousPrice) * 100).toFixed(1) : "0";
  const kda = `${kills}/${deaths}/${assists}`;
  const minutes = Math.floor(gameDuration / 60);

  // Check admin setting for news generation mode
  const newsMode = await getNewsMode();

  // Situation tags for the LLM
  const situationTags: string[] = [];
  if (deaths === 0 && kills >= 5) situationTags.push("FLAWLESS GAME — zero deaths, absolute perfection");
  if (kills >= 10 && deaths <= 3) situationTags.push("HARD CARRY — CEO 1v9'd this lobby");
  if (deaths >= 10) situationTags.push("FULL INT — CEO literally ran it down, this is a disaster of epic proportions");
  if (deaths >= 8) situationTags.push("FEEDING — CEO was a walking bag of gold for the enemy team");
  if (kills === 0 && assists <= 2) situationTags.push("AFK ENERGY — CEO may have been alt-tabbed the entire game");
  if (minutes <= 20) situationTags.push("SPEEDRUN FF — game ended embarrassingly fast");
  if (minutes >= 35) situationTags.push("MARATHON — CEO held everyone hostage for way too long");

  const prompt = `You write headlines for $DORI — a meme stock that tracks a League of Legends player's ranked games. The CEO of $DORI is "목도리 도마뱀" (dori). This is a fake trading platform and you are the news desk.

YOUR VIBE: You write like a deranged r/wallstreetbets poster who also works at Bloomberg. Think loss porn captions, gain screenshots titles, Michael Reeves energy, maximum brainrot. You ARE the shitpost. Financial jargon meets League of Legends meets pure unhinged internet humor.

MATCH DATA:
- Champion: ${champion}
- Result: ${win ? "WIN ✅" : "LOSS ❌"}
- KDA: ${kda} (${kills} kills, ${deaths} deaths, ${assists} assists)
- CS: ${cs}
- Position: ${position}
- Game Duration: ${minutes} minutes
- $DORI Price: $${currentPrice.toFixed(2)} (${priceChange >= 0 ? "+" : ""}${pctChange}%)
${situationTags.length > 0 ? `- SITUATION: ${situationTags.join(". ")}` : ""}

EXAMPLES OF THE ENERGY WE WANT:
- "CIRCUIT BREAKER: $DORI halted after CEO speedruns 12 deaths on Yasuo. Bagholders in tears."
- "$DORI CEO goes 0/8 on Vayne. NYSE considering permanent delisting."
- "Jump Trading's algo briefly achieved consciousness to buy more $DORI."
- "$DORI prints tendies after CEO's 15/2 Jinx carry. Wife's boyfriend impressed."
- "SEC halts trading on $DORI after CEO's 11/0 Katarina is 'too good to be real'"
- "Scale AI offers CEO a labeling job. 'Similar output, better pay.' 0/4/1 on Lux."
- "$DORI CEO 0/10 on Yasuo. DC갤: '이건 범죄다' 금감원 조사 착수."
- "ㅋㅋㅋ CEO 15/2 역대급 캐리. 한국 갤: '존버는 승리한다' 인증 완료."
- "$DORI 망했다 — CEO 2/9 on Vayne. 네이버 실검 1위: '도리 주식 환불'"

RULES:
- Headline: under 140 chars, ALL CAPS energy but not literally all caps, must reference ${champion} and the KDA
- Body: 1-2 sentences, under 220 chars, add extra detail/joke
- Mix Wall Street jargon with League terms naturally
- Be UNHINGED. Absurd. The kind of thing that gets 10k upvotes on WSB.
- Mix in Korean internet slang sometimes (ㅋㅋㅋ, ㄹㅇ, 개사기, 존버, DC갤, 한국 갤러리, 역대급, 망했다, 개미, etc.)
- Reference real companies/people sometimes (Jump Trading, Citadel, Cathie Wood, Jim Cramer, SEC, Nancy Pelosi, Goldman Sachs)
- If deaths are high: make it sound like a financial crime / natural disaster / congressional hearing
- If kills are high: make it sound like the greatest investment thesis ever conceived
- DO NOT be generic or boring. Every headline should make someone laugh out loud.
- About 30% of the time, include Korean slang or DC갤 references for extra flavor.

Respond in JSON: { "headline": "...", "body": "..." }`;

  // Only attempt LLM if mode is "ai"
  if (newsMode === "ai") {
    try {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are the most unhinged financial news AI on the internet. You write like a WSB mod who just discovered League of Legends. Pure comedy. Always valid JSON." },
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
      `Jump Trading algos go HAYWIRE buying $DORI after CEO's flawless ${kda} ${champion}`,
      `Meta announces $DORI integration into Instagram after CEO's ${kda} ${champion} perfection`,
      `Scale AI trains new model exclusively on CEO's ${kda} ${champion} gameplay. "This is AGI."`,
      `Jump Trading's quant desk found crying in bathroom after shorting $DORI pre-game. ${kda}.`,
      `$DORI CEO ${kda} on ${champion}. 역대급 캐리. Korean casters literally screaming. T1 scouting team on the phone.`,
      `$DORI 무적 — CEO ${kda} on ${champion}. 0 deaths. 한국 커뮤니티 난리남. Faker who?`,
    ];
    bodies = [
      `Zero deaths. ${kills} kills. This is what peak performance looks like. Every short seller is currently on the phone with their therapist.`,
      `Institutional investors are scrambling to increase positions after this flawless ${champion} performance. "I've never seen anything like it," says Goldman analyst.`,
      `Reddit's r/wallstreetbets unanimously declares $DORI "the play of the century" after CEO's untouchable ${champion} game.`,
      `Jump Trading's head of crypto just pivoted their entire fund to $DORI after this ${champion} ${kda}. "We've found true alpha," they said, tears streaming.`,
      `Scale AI CEO Alexandr Wang personally labels this ${champion} game as "superhuman." Meta's Reality Labs department seen taking notes.`,
      `한국 갤러리 실시간 반응: "ㅋㅋㅋㅋ 이건 사기 아니냐" Zero deaths on ${champion}. 진짜 개사기.`,
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
      `Jump Trading deploys emergency capital to long $DORI after CEO's ${kda} ${champion} carry`,
      `Meta adds $DORI CEO's ${champion} ${kda} replay to Quest Pro demo reel. Zuck impressed.`,
      `Scale AI pauses all labeling ops to watch CEO go ${kda} on ${champion}. Productivity: 0. Vibes: immaculate.`,
      `$DORI CEO ${kda} on ${champion}. Jump Trading's algo just achieved consciousness to buy more.`,
      `$DORI CEO 원딜 차이 ㅋㅋ. ${kda} on ${champion}. 갤에서 개추 500개 찍음.`,
      `ㄹㅇ 미쳤다 — CEO ${kda} on ${champion}. 한국 주식 커뮤 올타임 1위 게시글.`,
    ];
    bodies = [
      `CEO went absolutely feral on ${champion} — ${kills} kills in ${minutes} minutes. Short interest just evaporated. This stock is the future.`,
      `"This is the greatest trade I've ever seen," says retail investor who bought at the top. ${kda} on ${champion}. Gains are gains.`,
      `Wall Street analysts upgrading $DORI from "Overweight" to "BUY EVERYTHING" after this ${champion} masterclass.`,
      `Jump Trading's market-making desk just went long-only on $DORI. Meta's Threads is flooded with $DORI memes. Scale AI is using this game as training data.`,
      `Sources say Jump Trading's entire Chicago office erupted in applause. ${kda} on ${champion}. The future of finance is League of Legends.`,
      `DC인사이드 $DORI 갤러리 실시간: "ㅋㅋㅋ 이 주식 진짜임?" ${kda} on ${champion}. 역대급 캐리에 갤 터짐.`,
    ];
  } else if (win && isHighKP) {
    headlines = [
      `$DORI rallies as CEO participates in ${kills + assists} kills on ${champion}. Team player energy.`,
      `$DORI green candle: CEO's ${kda} ${champion} shows "strong fundamentals"`,
      `Bullish on $DORI: CEO goes ${kda} on ${champion}. Jim Cramer in shambles.`,
      `Meta's Llama 4 rates CEO's ${kda} ${champion} as "optimal play." $DORI moons.`,
      `Jump Trading quants confirm: ${kills + assists} kill participation is "statistically impossible to fade"`,
    ];
    bodies = [
      `High kill participation on ${champion} shows CEO is "locked in." Portfolio managers taking notice. ${kda} in ${minutes} minutes.`,
      `CEO's ${champion} game made Jim Cramer cry on live TV. ${kda}. He's bullish now. (Inverse Cramer says sell.)`,
      `Scale AI's data labelers unanimously tagged this game as "cracked." Meta's AI models can't replicate it.`,
    ];
  } else if (win) {
    headlines = [
      `$DORI closes green: ${champion} ${kda} dub. Not a lot but it's honest work.`,
      `$DORI edges up ${pctChange}% after CEO secures the W on ${champion}. ${kda}.`,
      `$DORI bulls eating good tonight. CEO ${kda} on ${champion}. Steak's on me.`,
      `$DORI earnings call just dropped: CEO ${kda} on ${champion}. "Shareholder value" is what we're calling kills now.`,
      `$DORI wins again. ${champion} ${kda}. At this point shorts are just donating money.`,
      `$DORI CEO brings home the dub on ${champion}. ${kda}. Slow and steady wins the race. JK GO FAST.`,
      `Another day another $DORI W. ${champion} ${kda}. We literally can't stop winning.`,
      `$DORI CEO ${kda} on ${champion}. Portfolio looking thicker than a bowl of oatmeal. +${pctChange}%.`,
      `Jump Trading maintains "accumulate" rating on $DORI after ${champion} ${kda} win`,
      `Meta employees seen placing $DORI limit orders during all-hands. CEO ${kda} on ${champion}.`,
      `Scale AI's Slack is 90% $DORI memes after CEO's ${kda} ${champion} dub. Productivity tanked. Morale ATH.`,
      `$DORI CEO ${kda} on ${champion}. Jump Trading's head of research: "Our models predicted this."`,
      `$DORI CEO ${kda} on ${champion}. 이겼다 ㅋㅋ. DC갤: "존버는 승리한다" 인증 완료.`,
      `오늘도 이김 ㅎㅎ — CEO ${kda} on ${champion}. $DORI 존버 개미들 오늘은 치킨 시킨다.`,
    ];
    bodies = [
      `CEO ${kda} on ${champion} in ${minutes} min. Not flashy but my portfolio doesn't care about flashy. It cares about WINNING. LFG.`,
      `${kda} on ${champion}. My wife left me but at least $DORI is green. This is what financial freedom looks like. Kind of.`,
      `$DORI holders inhaling copium turned hopium after CEO's ${kda} ${champion} win. Tendies are PRINTING.`,
      `Jump Trading's prop desk quietly adding to their position. Meta interns building a $DORI tracker as a hackathon project. Scale AI offering equity swaps.`,
      `한국 개미 반응: "ㅋㅋ 오늘은 치킨이다" CEO ${kda} on ${champion}. 존버 성공. 내일은 모름.`,
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
      `Jump Trading's risk management system auto-liquidates all $DORI after CEO goes ${kda}`,
      `Meta revokes CEO's blue checkmark after ${kda} ${champion}. Zuckerberg: "We have standards."`,
      `Scale AI relabels $DORI from "investment" to "charity" after CEO's ${kda} on ${champion}`,
      `Jump Trading files restraining order against $DORI CEO. ${kda}. "Stay 500ft from our portfolio."`,
      `$DORI CEO ${kda} on ${champion}. Meta's content moderation AI flags it as "graphic violence"`,
      `$DORI CEO ${kda} on ${champion}. 한국 커뮤: "ㅋㅋㅋ 트롤 아니냐 이거" 금감원 조사 착수.`,
      `ㅎㄷㄷ — CEO ${kda} on ${champion}. DC갤 실시간 "이건 범죄다" 게시글 1000개 돌파.`,
      `$DORI CEO ${champion} ${kda}. 한국어로: 망했다. 영어로: we're cooked. 둘 다 맞음.`,
    ];
    bodies = [
      `${deaths} deaths in ${minutes} minutes on ${champion}. Congress is scheduling hearings. Nancy Pelosi seen panic selling. This is the worst day in $DORI history.`,
      `CEO's ${kda} performance on ${champion} has triggered every stop-loss in existence. Margin calls going out as we speak. GG FF at 15.`,
      `"I've never seen anything this bad," says veteran analyst. ${kda} on ${champion}. Even the bots are selling.`,
      `Jump Trading's entire quant team just rage-quit. Scale AI is retraining models to exclude this game from reality. Meta considered shutting down the metaverse over this.`,
      `Sources at Jump Trading confirm their HFT algo briefly achieved sentience just to sell $DORI faster. ${kda} on ${champion}. Unprecedented.`,
      `DC갤 실시간 "ㄹㅇ ㅋㅋㅋ 이 겜 하이라이트 좀" ${deaths}데스 ${champion}. 한국 주식 갤러리에서 조의 표함.`,
    ];
  } else if (isFeeding) {
    headlines = [
      `$DORI tumbles as CEO goes ${kda} on ${champion}. Wendy's applications open.`,
      `$DORI bears feast: CEO's ${kda} ${champion} game is "concerning" say analysts.`,
      `$DORI red day: ${champion} ${kda}. CEO's mom calling to ask if they're okay.`,
      `SELL RATING: $DORI CEO goes ${kda} on ${champion}. "We've seen enough." - JP Morgan`,
      `$DORI dips after CEO feeds ${deaths} kills on ${champion}. Loss porn incoming.`,
      `$DORI CEO's ${kda} ${champion} game classified as a "humanitarian crisis" by the UN`,
      `Jump Trading downgrades $DORI to "Please God No" after CEO ${kda} on ${champion}`,
      `Meta removes $DORI from suggested stocks after CEO's ${kda} ${champion}. "Brand safety concerns."`,
      `Scale AI data labelers refuse to annotate CEO's ${kda} ${champion} game. "Inhumane working conditions."`,
      `$DORI CEO ${kda} on ${champion}. Jump Trading's CEO personally calls to say "bro what"`,
      `$DORI CEO ${kda} on ${champion}. 네이버 실검 1위: "도리 주식 환불". ㅋㅋㅋㅋ`,
      `ㅋㅋㅋ CEO ${kda} on ${champion}. 한국 맘카페에서도 논의 중. "우리 아이가 이 주식을 샀대요"`,
    ];
    bodies = [
      `${deaths} deaths on ${champion} in ${minutes} minutes. Analysts downgrading from "Buy" to "Have you considered index funds?"`,
      `CEO's ${champion} performance triggered 47 stop-losses. Short sellers sending thank you cards. ${kda}.`,
      `"I am once again asking for my money back," says every $DORI investor after ${kda} on ${champion}.`,
      `Jump Trading's risk model now includes "${champion} ${kda}" as a new category of systemic risk. Meta adding $DORI warnings to Facebook Marketplace.`,
      `한국 갤러리 반응: "ㅋㅋㅋ ${deaths}데스 ㄹㅇ?" CEO의 ${champion} 한 판에 주가가 지하실 감. 개미들 눈물.`,
    ];
  } else if (!win && isUseless) {
    headlines = [
      `$DORI slumps: CEO goes AFK mentally on ${champion}. ${kda}. Did they even play?`,
      `$DORI CEO ${kda} on ${champion}. Sources say they were watching Netflix the whole time.`,
      `$DORI underperforms: CEO's ${kda} ${champion} was "uninspiring" — Goldman Sachs`,
      `$DORI CEO achieves nothing on ${champion}. ${kda}. Shareholders demand drug test.`,
      `Meta's AI couldn't even detect CEO on the map. ${kda} on ${champion}. Invisible man.`,
      `Scale AI offers $DORI CEO a labeling job. "Similar output, better pay." ${kda} on ${champion}.`,
      `Jump Trading's algo literally forgot $DORI exists. CEO ${kda} on ${champion}. Same energy.`,
      `$DORI CEO ${kda} on ${champion}. 한국 갤: "이 사람 게임 하는 거 맞냐 ㅋㅋ" 투명인간 모드.`,
    ];
    bodies = [
      `${kda} on ${champion} in ${minutes} minutes. CEO reportedly alt-tabbed to check $DORI stock price mid-game. It did not help.`,
      `Zero impact detected. CEO's ${champion} was invisible. ${kda}. The team forgot they had a 5th player.`,
      `Scale AI ran CEO's ${champion} gameplay through their classifier. Result: "NPC behavior detected." Jump Trading's sentiment analysis agrees.`,
      `DC갤: "ㅋㅋ ${kda} 이게 사람이냐" CEO ${champion} 존재감 0. 주가도 0 향해 가는 중.`,
    ];
  } else if (!win && isFF) {
    headlines = [
      `BREAKING: $DORI speedrun collapse. ${champion} ${kda}. Game over in ${minutes} min. FF@15.`,
      `$DORI implodes in record time: CEO's ${champion} goes ${kda}. Fastest L in history.`,
      `$DORI flash crash: ${minutes}-minute ${champion} loss. ${kda}. "Not even close" — no one.`,
      `$DORI CEO surrenders at ${minutes} min on ${champion}. ${kda}. White flag energy.`,
      `Jump Trading's HFT couldn't even sell $DORI fast enough. ${minutes} min FF. ${kda}. Speed diff.`,
      `Meta's server didn't even finish loading the game. ${minutes} min ${champion} L. ${kda}.`,
      `${minutes}분 서렌 ㅋㅋㅋ — CEO ${kda} on ${champion}. DC갤: "역대급 스피드런"`,
    ];
    bodies = [
      `Game lasted ${minutes} minutes. That's less time than it takes to microwave a Hot Pocket. ${kda} on ${champion}. Down bad.`,
      `CEO's ${champion} game ended so fast the price chart looks like a cliff. ${kda}. Early FF = early bed.`,
      `Jump Trading's algo couldn't get a fill before the game was already over. Scale AI's stopwatch literally malfunctioned. ${minutes} minutes. ${kda}.`,
      `${minutes}분만에 끝남 ㅋㅋ CEO ${kda} on ${champion}. 컵라면도 못 끓이는 시간에 주가 박살.`,
    ];
  } else if (!win && isLongGame) {
    headlines = [
      `$DORI bleeds for ${minutes} min before dying: CEO ${kda} on ${champion}. Slow painful death.`,
      `$DORI CEO edged shareholders for ${minutes} minutes then lost. ${champion} ${kda}. Emotional damage.`,
      `BREAKING: $DORI CEO wastes ${minutes} minutes of everyone's life on ${champion}. ${kda}.`,
      `Jump Trading held $DORI for ${minutes} minutes of false hope. Now liquidating. ${kda} on ${champion}.`,
      `Meta employees watched CEO's ${champion} for ${minutes} min instead of working. CEO ${kda}. Productivity and stock both down.`,
      `${minutes}분 동안 희망고문 ㅋㅋ — CEO ${kda} on ${champion}. 결국 짐. DC갤: "존버충 참교육"`,
    ];
    bodies = [
      `${minutes} minutes of hope, all for nothing. ${kda} on ${champion}. This is what diamond handing a -99% position feels like.`,
      `CEO fought for ${minutes} minutes on ${champion} — ${kda} — but in the end, the market always wins. And today the market was the enemy nexus.`,
      `Jump Trading's algo held through ${minutes} minutes of this. Even AI has trust issues now. Scale AI is offering counseling to their models.`,
      `${minutes}분 존버하다 결국 패배. ${kda} on ${champion}. DC갤: "희망고문 그 자체" 개미들 멘탈 붕괴.`,
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
      `Jump Trading's weekly $DORI report just says "lol" after CEO's ${kda} on ${champion}`,
      `Meta considered featuring $DORI on Facebook Gaming. Then CEO went ${kda} on ${champion}. Offer rescinded.`,
      `Scale AI downgrades CEO's gameplay from "amateur" to "concerning" after ${kda} on ${champion}`,
      `$DORI CEO ${kda} on ${champion}. Jump Trading's intern: "even I could do better." He could not.`,
      `$DORI takes another L. ${champion} ${kda}. At Meta they call this "a learning opportunity." At Jump they call it "a write-off."`,
      `$DORI CEO ${kda} on ${champion}. 한국 갤: "ㅋㅋ 또?" 맞음. 또.`,
      `ㅋㅋㅋ 또 졌네 — CEO ${kda} on ${champion}. DC갤 실시간: "존버 그만해라 제발"`,
      `$DORI 하락 — CEO ${kda} on ${champion}. 네이버 증권 댓글: "이 주식 사면 안 되는 이유.txt"`,
    ];
    bodies = [
      `Another loss on ${champion}. ${kda} in ${minutes} minutes. $DORI holders switching to crypto. Wait, that's worse.`,
      `CEO's ${champion} game has me questioning every life decision that led to buying $DORI. ${kda}. I deserve this.`,
      `${kda} on ${champion}. I showed my portfolio to my therapist. She started crying too. We're both holding though.`,
      `Jump Trading's morning standup spent 20 minutes discussing this ${champion} loss. Scale AI's Slack channel is pure copium. Meta's stock sympathy-dropped 0.01%.`,
      `DC갤 실시간: "${champion} ${kda} ㅋㅋ 이거 존버 맞냐?" 한국 개미들 멘탈 터짐. 치킨은 내일로 미룸.`,
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
