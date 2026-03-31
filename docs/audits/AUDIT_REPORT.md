# $DORI LP Tracker — Full Backend Audit Report

> Generated 2026-03-25 by 6 parallel audit agents covering: Trading Engine, Polling Engine & Riot API, ETF Pricing & Bot Trader, Auth & Security, DB Schema & Data Integrity, API Surface & Input Validation.

---

## Executive Summary

**Total findings: 73** across 6 audit areas.

| Severity | Count | Description |
|----------|-------|-------------|
| **CRITICAL** | 10 | Exploitable vulnerabilities, data corruption risks |
| **HIGH** | 14 | Significant logic errors, security gaps |
| **MEDIUM** | 24 | Design issues, missing validation, inconsistencies |
| **LOW** | 25 | Minor issues, code quality, maintenance concerns |

The most dangerous findings are:
1. **Client-supplied `pricePerShare` is trusted** — anyone with dev tools can buy at $0.01 or sell at $10,000 (Trading #2)
2. **`auth.me` leaks `passwordHash`** to every authenticated client (API #4)
3. **Polling control endpoints are unauthenticated** — anyone can stop the entire engine (API #1)
4. **Default JWT secret allows token forgery** in production (Auth #1)
5. **No DB transactions** on multi-statement trade operations (Schema #1)

---

## CRITICAL Findings (10)

### C1. Client-supplied `pricePerShare` trusted for trade execution
**Area:** Trading | **Files:** `routers.ts:425-426, 462-463, 486-487`

The client sends `pricePerShare` and the server uses it directly without verifying against the actual ETF price. A malicious user can buy at $0.01 or sell at $10,000 via browser dev tools.

**Fix:** Compute ETF price server-side and use that, or validate client price within tight tolerance (e.g., 2%).

---

### C2. `auth.me` returns full User object including `passwordHash`
**Area:** API Surface | **Files:** `routers.ts:40`, `sdk.ts:123`

`ctx.user` is a raw DB row including `passwordHash`, `openId`, and all internal fields. Every authenticated user's bcrypt hash is sent to the browser.

**Fix:** Strip sensitive fields: `const { passwordHash, openId, ...safeUser } = opts.ctx.user;`

---

### C3. Polling control endpoints are unauthenticated
**Area:** API Surface | **File:** `routers.ts:715-731`

`poll.trigger`, `poll.start`, and `poll.stop` are `publicProcedure`. Anyone can stop the polling engine or spam `trigger` to exhaust Riot API rate limits.

**Fix:** Change to `adminProcedure`.

---

### C4. `player.refresh` is unauthenticated and writes to DB
**Area:** API Surface | **File:** `routers.ts:135-153`

Any anonymous user can call `player.refresh` to flood `priceHistory` with duplicate snapshots and poison ETF compounding.

**Fix:** Change to `adminProcedure` or add rate limiting.

---

### C5. Default JWT secret is hardcoded and predictable
**Area:** Auth | **File:** `env.ts:3`

Fallback secret `"change-me-in-production"` allows token forgery if `JWT_SECRET` is not set. Server does not refuse to start.

**Fix:** Refuse to start in production if JWT_SECRET is the default.

---

### C6. `withUserLock` mutex has race condition
**Area:** Trading | **File:** `db.ts:144-161`

The mutex has a TOCTOU gap — between checking `pending` and storing the new promise, a concurrent request can slip through. Enables double-spend.

**Fix:** Use a proper mutex queue pattern (queue-based promise chaining).

---

### C7. No DB transactions on multi-statement trade operations
**Area:** Schema | **Files:** `db.ts:166-198, 206-239, 245-276`

Each trade performs 3-4 SQL statements (read portfolio, update cash, update holdings, insert trade) without a transaction. Process crash mid-trade = data corruption.

**Fix:** Wrap in `db.transaction()`.

---

### C8. `player.dismissGameEndEvent` is unauthenticated global side effect
**Area:** API Surface | **File:** `routers.ts:221-225`

Any anonymous user can dismiss the game-end event banner for ALL users by clearing the shared cache.

**Fix:** Handle dismissal client-side only (localStorage) and remove endpoint.

---

### C9. Admin raw SQL endpoint accepts arbitrary SQL
**Area:** Auth | **File:** `routers.ts:735-770`

Full database access if admin account is compromised (trivial with C5).

**Fix:** Restrict to read-only, or gate behind `ADMIN_SQL_ENABLED` env flag.

---

### C10. Master/Grandmaster/Challenger tiers all map to $100 (price ceiling)
**Area:** Polling | **File:** `riotApi.ts:203-216`

`totalLPToPrice()` clamps at 1200 total LP. All Master+ players get $100.00 with zero price sensitivity. If the tracked player reaches Master, the stock becomes flat.

**Fix:** Extend price range for Master+ tiers, or document as intentional.

---

## HIGH Findings (14)

### H1. SQL injection in admin CRUD endpoints
**Area:** Auth/API | **File:** `routers.ts:908-1006`

Table names and IDs are string-interpolated. `orderCol`, `id` values bypass sanitization.

**Fix:** Use parameterized queries (`client.execute({ sql, args })`).

### H2. No rate limiting on login/register
**Area:** Auth | **File:** `routers.ts:77-98, 46-76`

Unlimited brute-force login and account creation.

**Fix:** Add `express-rate-limit` on auth endpoints.

### H3. `Infinity` passes Zod `.positive()` — can corrupt portfolios
**Area:** API | **File:** `routers.ts:423-426, 461-463, 485-487, 510-514`

`shares: z.number().positive()` accepts `Infinity`. Computing `Infinity * price` stores `"Infinity"` or `"NaN"` in DB.

**Fix:** Add `.finite()` to all numeric trade inputs.

### H4. Order double-execution on crash
**Area:** Trading | **File:** `pollEngine.ts:317-338, db.ts:315-319`

`fillOrder` updates status to "filled" AFTER `executeTrade`. Crash between them = order re-executed on next poll.

**Fix:** Atomic operation: update status before execution, or wrap in transaction.

### H5. Short selling cash flow allows free leverage
**Area:** Trading | **File:** `db.ts:219-221`

Short sale credits 100% proceeds but only locks 50% margin. User can spend proceeds on other assets, then be unable to cover.

**Fix:** Track margin as separate locked field, not mixed into cashBalance.

### H6. No funds validation when placing orders
**Area:** Trading | **File:** `db.ts:280-295, pollEngine.ts:331`

Users can place unlimited limit_buy orders without funds. Multiple can trigger simultaneously; first fills, rest fail silently but remain "pending" forever.

**Fix:** Escrow funds on order creation, or mark orders as "failed" when execution throws.

### H7. Bot does NOT respect 40% cash limit
**Area:** ETF/Bot | **File:** `botTrader.ts:256, 440-448`

Prompt tells LLM "max 40% of cash" but code allows 95%. Bot can concentrate entire portfolio in one position.

**Fix:** Enforce in `executeDecision`: `Math.min(decision.amount, cash * 0.40)`.

### H8. Bot trades during market halt when humans can't
**Area:** ETF/Bot | **File:** `botTrader.ts:536-581`

Bot reads `isInGame` but only logs it, never gates on it. Unfair advantage/disadvantage.

**Fix:** Add halt check: `if (isInGame) return false;`

### H9. Inconsistent `throw new Error()` vs `TRPCError` in market checks
**Area:** API | **File:** `routers.ts:438, 475, 499`

Plain `Error` = 500 INTERNAL_SERVER_ERROR in production with generic message. Client gets no useful feedback.

**Fix:** Use `throw new TRPCError({ code: "PRECONDITION_FAILED", ... })`.

### H10. No foreign key constraints in DDL
**Area:** Schema | **File:** `schema.ts` (all tables)

`PRAGMA foreign_keys=ON` is set but no tables define `REFERENCES`. Orphaned records possible.

**Fix:** Add `.references(() => users.id)` to all userId columns.

### H11. No indexes on frequently queried columns
**Area:** Schema | **File:** `schema.ts`

Missing indexes on: `holdings(userId, ticker)`, `trades(userId, createdAt)`, `orders(userId, status)`, `priceHistory(timestamp)`, `portfolioSnapshots(userId, timestamp)`, `notifications(userId, read)`.

**Fix:** Add composite indexes.

### H12. `getLeaderboard` fetches ALL holdings with O(n^2) filter
**Area:** Schema | **File:** `db.ts:514-528`

Loads every holding row, then filters with nested `.filter()` per user.

**Fix:** JOIN or group by userId with a Map.

### H13. Redundant API call on game-start detection
**Area:** Polling | **File:** `pollEngine.ts:117-118, 142-143`

`fetchFullPlayerData()` called twice — once for live game check, again for snapshot. Wastes 6 Riot API calls.

**Fix:** Reuse data from first call.

### H14. Full poll cycle crashes on Riot API failure
**Area:** Polling | **File:** `pollEngine.ts:168`

If Riot API is down, entire poll cycle fails — no price snapshots, no order execution, no bot.

**Fix:** Wrap sections independently, use cached rank as fallback.

---

## MEDIUM Findings (24)

| # | Area | Finding | File |
|---|------|---------|------|
| M1 | Auth | No session revocation (1-year tokens) | `sdk.ts:56` |
| M2 | Auth | Cookie `secure` flag based on spoofable header | `cookies.ts:8-16` |
| M3 | Auth | Email enumeration via register ("Email already registered") | `routers.ts:54-55` |
| M4 | Auth | No registration limits (no CAPTCHA, no invite code) | `routers.ts:46-76` |
| M5 | Auth | 50MB request body size limit | `index.ts:159-160` |
| M6 | Auth | Health endpoint leaks DB path and CORS config | `index.ts:163-173` |
| M7 | Trading | No max share limit per trade | `routers.ts:425` |
| M8 | Trading | Float precision drift in cost basis | `db.ts:180` |
| M9 | Trading | Dividends bypass user lock | `db.ts:385-435` |
| M10 | Trading | Orders placeable on closed market (inconsistent) | `routers.ts:516-531` |
| M11 | Polling | API error defaults to `rawIsInGame = false` (false game-end) | `pollEngine.ts:121-125` |
| M12 | Polling | All matches get same priceBefore/priceAfter | `pollEngine.ts:230-240` |
| M13 | Polling | `getProcessedMatchIds` loads ALL match IDs every cycle | `db.ts:444-448` |
| M14 | Polling | Fetches full details for already-processed matches | `riotApi.ts:368-388` |
| M15 | Polling | Fragile cache save/restore around `invalidateAll()` | `pollEngine.ts:397-405` |
| M16 | Polling | No Riot API rate limit handling (no 429 retry) | `riotApi.ts` |
| M17 | ETF/Bot | Bot short-selling allows 160% of cash | `botTrader.ts:463-471` |
| M18 | ETF/Bot | Dead client-side `getETFPrice()` with no floor | `playerData.ts:68-79` |
| M19 | API | No trading cooldown enforcement (documented but missing) | `routers.ts:422-507` |
| M20 | API | Comment ticker not validated against allowed set | `routers.ts:598` |
| M21 | API | No rate limiting on comment posting | `routers.ts:595-605` |
| M22 | API | Ledger/comments/news cache keys ignore `limit` parameter | `routers.ts:562-617` |
| M23 | API | `priceHistory`/`portfolioHistory` queries unbounded | `routers.ts:353-360, 663-676` |
| M24 | Schema | `updatedAt` never actually updated on writes | `schema.ts` |

---

## LOW Findings (25)

| # | Area | Finding | File |
|---|------|---------|------|
| L1 | Auth | No display name sanitization (XSS if React escaping bypassed) | `routers.ts:100` |
| L2 | Auth | Weak password policy (min 6, no complexity) | `routers.ts:49` |
| L3 | Auth | Missing standard JWT claims (iat, sub, iss) | `sdk.ts:60-67` |
| L4 | Auth | DB write (lastSignedIn) on every authenticated request | `sdk.ts:118-121` |
| L5 | Trading | No DB transactions on multi-table writes | `db.ts:166-198` |
| L6 | Trading | `getOrCreate` insert-then-select race | `db.ts:112-132` |
| L7 | Trading | `fillOrder` doesn't verify current status | `db.ts:315-319` |
| L8 | Trading | Shared live game cache across all users | `routers.ts:429-435` |
| L9 | Polling | Sub-Platinum tiers all map to $10 | `riotApi.ts:215` |
| L10 | Polling | Unknown tier/division silently defaults to Platinum | `riotApi.ts:208-209` |
| L11 | Polling | First poll always delays confirmation by one cycle | `pollEngine.ts:129-138` |
| L12 | Polling | `matchPrice` variable computed but never used | `pollEngine.ts:240` |
| L13 | Polling | Game-end event TTL resets every poll (persists beyond 10 min) | `pollEngine.ts:397-405` |
| L14 | ETF/Bot | ETF $0.01 floor = "roach motel" (ETF dies permanently) | `etfPricing.ts:64, 173` |
| L15 | ETF/Bot | `prevBase <= 0` guard skips silently (no log) | `etfPricing.ts:62` |
| L16 | ETF/Bot | `parseFloat` on DB fields without NaN guard | `etfPricing.ts:47, botTrader.ts:139-148` |
| L17 | ETF/Bot | Ticker definitions duplicated in 3 places | multiple files |
| L18 | ETF/Bot | Fallback strategy only buys, never sells | `botTrader.ts:374-414` |
| L19 | ETF/Bot | `forceRunBot` duplicates `runBotTrader` | `botTrader.ts:599-627` |
| L20 | ETF/Bot | Dividend refs in bot prompt but dividends disabled | `botTrader.ts:245` |
| L21 | Schema | `relations.ts` is empty | `relations.ts:1` |
| L22 | Schema | `executeMultiple` for PRAGMAs not awaited | `db.ts:26` |
| L23 | Schema | No display name uniqueness | `schema.ts:12` |
| L24 | Schema | Duplicate `(userId, ticker)` holdings possible (no unique constraint) | `schema.ts:44-54` |
| L25 | API | Typo in Korean player name at one call site (`뱰` vs `뱀`) | `routers.ts:189` |

---

## Recommended Fix Priority

### Phase 1: Security-Critical (do immediately)
1. **C2** — Strip `passwordHash` from `auth.me` response
2. **C1** — Server-side price validation (stop trusting client `pricePerShare`)
3. **C3/C4/C8** — Change polling/refresh/dismiss endpoints to `adminProcedure`/`protectedProcedure`
4. **C5** — Block server start with default JWT secret in production
5. **H3** — Add `.finite()` to all Zod numeric inputs

### Phase 2: Data Integrity (do soon)
6. **C7** — Wrap trades in `db.transaction()`
7. **C6** — Fix `withUserLock` mutex race condition
8. **H4** — Atomic order fill (prevent double-execution)
9. **H6** — Mark failed orders as "failed" instead of retrying forever
10. **H10** — Add foreign key constraints

### Phase 3: Game Balance
11. **H7/H8** — Fix bot trading constraints (40% limit, market halt)
12. **H5** — Separate margin tracking from cash balance
13. **M7** — Add max share limit + `.finite()` on trading inputs

### Phase 4: Performance & Polish
14. **H11** — Add DB indexes
15. **H12** — Fix leaderboard N^2 query
16. **M22** — Fix cache keys to include `limit` parameter
17. **M14** — Only fetch details for unprocessed matches
18. **H13** — Eliminate redundant Riot API calls
