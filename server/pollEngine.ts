/**
 * LP Polling Engine
 * Runs every 20 minutes to:
 * 1. Fetch current LP from Riot API
 * 2. Store price snapshot
 * 3. Fetch new matches and store them
 * 4. Generate AI meme news for new matches
 * 5. Distribute dividends for new matches
 * 6. Execute pending limit orders and stop-losses
 * 7. Update market status
 */
import {
  fetchFullPlayerData, fetchRecentMatches, tierToPrice, tierToTotalLP
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

// Player config
const GAME_NAME = "목도리 도마뱀";
const TAG_LINE = "dori";
const PUUID_CACHE: { puuid?: string } = {};

// Polling interval (20 minutes)
const POLL_INTERVAL_MS = 20 * 60 * 1000;

let pollTimer: NodeJS.Timeout | null = null;
let isPolling = false;
let lastPollTime: Date | null = null;
let lastPollResult: PollResult | null = null;

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
    // 1. Fetch current player data
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
    console.log("[Poll] Fetching recent matches...");
    const puuid = playerData.account.puuid;
    const recentMatches = await fetchRecentMatches(puuid, 10, 420);
    const processedIds = await getProcessedMatchIds();

    const previousPrice = await getLatestPrice();
    const prevPrice = previousPrice ? parseFloat(previousPrice.price) : price;

    for (const match of recentMatches) {
      const matchId = match.metadata.matchId;
      if (processedIds.has(matchId)) continue;

      const participant = match.info.participants.find(p => p.puuid === puuid);
      if (!participant) continue;

      const matchPrice = tierToPrice(tier, division, lp); // approximate

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
          priceBefore: prevPrice,
          priceAfter: price,
          gameCreation: match.info.gameCreation,
        });
        result.newMatches++;

        // 4. Distribute dividends
        try {
          const reason = participant.win
            ? `Win on ${participant.championName} (${participant.kills}/${participant.deaths}/${participant.assists})`
            : `Loss on ${participant.championName} (${participant.kills}/${participant.deaths}/${participant.assists})`;

          await distributeDividends(matchId, participant.win, reason);
          await markMatchDividendsPaid(matchId);
          result.dividendsPaid++;
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

    // 8. Update market status based on recent activity
    const hasRecentGame = recentMatches.some(m => {
      const endTime = m.info.gameEndTimestamp || (m.info.gameCreation + m.info.gameDuration * 1000);
      return Date.now() - endTime < 60 * 60 * 1000; // within last hour
    });

    if (hasRecentGame) {
      await setMarketStatus(true, "Player recently active in ranked");
    } else {
      // Market stays open but with a note
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
    cache.invalidateAll();
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

  // Small delay before first poll to ensure DB is ready (migrations may still be settling)
  setTimeout(() => {
    pollNow().catch(err => console.error("[Poll] Initial poll failed:", err));
  }, 3000);

  // Then every 20 minutes
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
