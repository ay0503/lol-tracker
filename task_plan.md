# Discord Bot NLP Trading Assistant — Implementation Plan

## Goal
Add an interactive Discord bot that listens for natural language messages, routes them through an LLM to understand intent, and either returns live data (portfolio, prices, leaderboard, game status) or executes trading actions (buy/sell/short/cover) with a reaction-based confirmation flow.

## Done looks like
- Users type messages in Discord like "what's my portfolio?" or "buy 5 DORI" and get formatted responses
- Read queries return instantly with rich embeds
- Trade actions return a preview embed; user reacts ✅ to confirm, ❌ to cancel
- Discord user IDs are linked to site accounts via a `/link` slash command

---

## Implementation Steps

### Phase 1: Foundation

1. [ ] **Install discord.js** — `package.json`
   - Add `discord.js` as a production dependency
   - Verify it installs alongside existing deps

2. [ ] **Add env vars** — `server/_core/env.ts`
   - Add `DISCORD_COMMAND_CHANNEL_ID` (channel where bot listens for commands, can reuse existing channel ID)
   - The bot token and channel ID already exist in env

3. [ ] **Add `discordId` column to users table** — `server/db.ts`
   - `ALTER TABLE users ADD COLUMN discordId TEXT` via `getRawClient()` (lazy init pattern)
   - Add helper: `getUserByDiscordId(discordId: string)`
   - Add helper: `linkDiscordUser(userId: number, discordId: string)`

4. [ ] **Create Discord Gateway client** — `server/discordBot.ts` (new file)
   - Initialize `discord.js` Client with `GatewayIntentBits.Guilds`, `MessageContent`, `GuildMessages`, `GuildMessageReactions`
   - Login with existing `ENV.discordBotToken`
   - Log ready event
   - Export `startDiscordBot()` function, called from server startup
   - Guard: only start if bot token is configured

### Phase 2: User Linking

5. [ ] **Add `/link` slash command** — `server/discordBot.ts`
   - Register command: `/link <email>` — looks up user by email, links discordId
   - Response: ephemeral "Linked to {displayName}!" or "No account found"
   - Also add `/unlink` to remove the mapping

6. [ ] **Add `/whoami` slash command** — `server/discordBot.ts`
   - Shows linked account name + cash balance + casino balance
   - Ephemeral response

### Phase 3: LLM Intent Router

7. [ ] **Create intent schema** — `server/discordIntent.ts` (new file)
   - Define `BotIntent` union type:
     ```
     | { type: "portfolio" }
     | { type: "prices" }
     | { type: "price", ticker: string }
     | { type: "leaderboard" }
     | { type: "live_game" }
     | { type: "casino_balance" }
     | { type: "match_history", count?: number }
     | { type: "holdings" }
     | { type: "buy", ticker: string, amount: number, unit: "dollars" | "shares" }
     | { type: "sell", ticker: string, amount: number, unit: "dollars" | "shares" }
     | { type: "short", ticker: string, amount: number, unit: "dollars" | "shares" }
     | { type: "cover", ticker: string, amount: number, unit: "dollars" | "shares" }
     | { type: "bet", prediction: "win" | "loss", amount: number }
     | { type: "help" }
     | { type: "unknown", message: string }
     ```

8. [ ] **Build LLM intent parser** — `server/discordIntent.ts`
   - `parseIntent(message: string): Promise<BotIntent>`
   - System prompt: list of available actions, valid tickers (DORI/DDRI/TDRI/SDRI/XDRI), rules
   - Use `invokeLLM()` with `response_format: { type: "json_object" }`
   - Fallback: if LLM fails or returns garbage, return `{ type: "unknown" }`

### Phase 4: Read-Only Query Handlers

9. [ ] **Implement read handlers** — `server/discordBot.ts`
   - `handlePortfolio(userId)` → embed with cash, holdings, total value, P&L
   - `handlePrices()` → embed with all 5 ETF tickers + daily change %
   - `handleLeaderboard()` → embed with top 10 by total value
   - `handleLiveGame()` → embed with in-game status, champion, duration (or "not in game")
   - `handleMatchHistory(count)` → embed with recent N matches (W/L, champion, KDA)
   - `handleCasinoBalance(userId)` → embed with casino cash
   - `handleHoldings(userId)` → embed with per-ticker shares, cost basis, P&L
   - `handleHelp()` → embed listing example commands

10. [ ] **Wire message listener to intent router** — `server/discordBot.ts`
    - On `messageCreate`: ignore bots, ignore messages outside command channel
    - Look up user by `discordId` (if not linked, reply "Use /link first")
    - Call `parseIntent(message.content)`
    - Route to appropriate handler
    - Reply with embed

### Phase 5: Trading with Confirmation

11. [ ] **Implement trade preview** — `server/discordBot.ts`
    - For buy/sell/short/cover intents: build preview embed showing:
      - Action, ticker, shares, price, total cost
      - Current balance, balance after trade
    - Add ✅ and ❌ reactions to the preview message
    - Store pending trade in a `Map<messageId, { userId, action, ticker, shares, price, expiresAt }>`

12. [ ] **Implement reaction confirmation** — `server/discordBot.ts`
    - On `messageReactionAdd`: check if message is a pending trade
    - ✅ from the original user → execute trade via `executeTrade`/`executeShort`/`executeCover`
    - ❌ from the original user → cancel, edit embed to "Cancelled"
    - Auto-expire after 60 seconds (cleanup interval)
    - On success: edit embed to show result (new balance, shares owned)
    - On failure: edit embed to show error

13. [ ] **Implement bet placement** — `server/discordBot.ts`
    - For bet intents: call `placeBet(userId, prediction, amount)` directly (no confirmation needed for small bets)
    - Reply with embed showing bet details

### Phase 6: Integration & Polish

14. [ ] **Start bot from server** — `server/_core/index.ts`
    - Import and call `startDiscordBot()` after Express server starts
    - Guard behind `isDiscordConfigured()` check

15. [ ] **Error handling & rate limiting** — `server/discordBot.ts`
    - Catch all handler errors, reply with friendly error message
    - Add per-user cooldown (1 command per 2 seconds) to prevent spam
    - LLM timeout: 10 second max, fall back to "I didn't understand"

16. [ ] **Add admin `/sql` command** — `server/discordBot.ts`
    - Only for admin users: `/sql <query>` runs raw SQL, returns results
    - Good for quick DB checks from Discord

---

## Files Changed / Created

| File | Change |
|---|---|
| `package.json` | Add `discord.js` dependency |
| `server/_core/env.ts` | Add `DISCORD_COMMAND_CHANNEL_ID` |
| `server/_core/index.ts` | Call `startDiscordBot()` |
| `server/db.ts` | Add `discordId` column, `getUserByDiscordId`, `linkDiscordUser` |
| `server/discordBot.ts` | **NEW** — Gateway client, message handler, slash commands, reaction handler |
| `server/discordIntent.ts` | **NEW** — LLM intent parsing, BotIntent types |
| `server/discord.ts` | Unchanged (existing webhooks keep working) |

---

## Risks

1. **discord.js size** — It's a large dependency (~50MB). Railway should handle it but increases cold start time.
2. **LLM latency** — Each message round-trips to the LLM API (500ms-2s). Mitigate with a "typing" indicator while processing.
3. **LLM hallucinations** — Could produce invalid tickers or impossible amounts. Validate all parsed intents before execution.
4. **Gateway connection** — discord.js needs a persistent WebSocket. Railway's always-on Railway service should be fine, but ephemeral containers would break it.
5. **Concurrent trades** — The existing `withUserLock` mutex in db.ts already handles this.
6. **New champion releases** — The `CHAMPION_NAMES` map in pollEngine.ts needs manual updates (existing issue, not new).

---

## Not In Scope (Future)
- Casino games via Discord (too complex for text interaction)
- Voice channel integration
- Multi-server support (single guild only)
- Slash command auto-complete for tickers
