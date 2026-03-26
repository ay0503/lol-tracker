# Valorant Team Balancer — Technical Design

## 1. Architecture: Option B (Integrated Feature) — Recommended

**Decision: Option B — Integrated Feature at `/valorant`**

Rationale:
- The app already has 24 pages and a well-established pattern for adding new ones (lazy import in App.tsx, tRPC router, shared auth/DB/cache). Adding one more page is trivial.
- The existing `cache.ts` (in-memory TTL cache with `getOrSet`, `invalidatePrefix`) is exactly what we need for caching Valorant API responses — zero new infrastructure.
- Auth is already solved: `protectedProcedure` gates access, and the 12-user friend group is already registered.
- SQLite + Drizzle is already set up for persistent storage. Adding a `valorant_players` table for cached stats is one migration.
- `routers.ts` is 2383 lines and growing, but adding ~150 lines for 3 valorant procedures is acceptable. If we later split routers into modules (already a Sprint 4 TODO), valorant routes move out cleanly.
- "Bloat" concern is minimal — the page is code-split via `React.lazy()`, so it adds zero bundle cost to non-valorant users.

What this means concretely:
- New file: `server/valorant.ts` (API client + balancing algorithm — NOT in routers.ts)
- New procedures in `routers.ts`: 3 tRPC routes calling into `server/valorant.ts`
- New page: `client/src/pages/Valorant.tsx`
- New route in `App.tsx`: `<Route path="/valorant" component={Valorant} />`
- New DB table: `valorant_player_cache` (optional, in-memory cache may suffice for MVP)

---

## 2. API Integration

### Which API?

Use **Henrik's Unofficial Valorant API** (`https://api.henrikdev.xyz/valorant`):
- Free tier: 30 requests/minute, no Riot production key needed
- Endpoints needed:
  - `GET /v2/account/{name}/{tag}` — resolve Riot ID to PUUID
  - `GET /v3/matches/{region}/{name}/{tag}?mode=competitive&size=20` — match history
  - `GET /v2/mmr/{region}/{name}/{tag}` — current rank + RR
- Paid tier ($5/mo): 100 req/min — worth it if usage grows

Fallback: Riot's official Valorant API requires a production key (weeks-long approval). Henrik API is the standard for community tools.

### Rate Limit Handling

```
Strategy: Sequential fetch with in-memory queue + exponential backoff

1. Queue: Process one player at a time (not parallel)
2. Delay: 2-second gap between requests (stays under 30/min)
3. Retry: On 429, wait `Retry-After` header seconds, then retry (max 3 retries)
4. Circuit breaker: After 5 consecutive failures, abort and return partial results
```

### Caching Strategy

Two layers:

**Layer 1: In-memory cache (existing `cache.ts`)**
- Key: `valorant.player.{name}#{tag}`
- TTL: 2 hours (competitive stats don't change that fast)
- Used for: quick re-balances with same players

**Layer 2: SQLite table (persistent across restarts)**
- Table: `valorant_player_cache`
- Columns: `riot_id TEXT PRIMARY KEY, region TEXT, data JSON, fetched_at INTEGER`
- TTL: 6 hours (check `fetched_at` before serving)
- Used for: surviving server restarts on Railway

### Batch Fetching: 10 Players

Worst case per player: 2 API calls (1 account lookup + 1 match history).
- 10 players = 20 API calls
- At 2-second spacing = 40 seconds total
- With caching: returning players skip API calls entirely

We do NOT need 100 matches per player. 20 recent competitive matches is sufficient for meaningful stats and keeps API calls at 2 per player.

---

## 3. Backend Design

### File: `server/valorant.ts`

```typescript
// ─── External API ───

export async function fetchValorantAccount(name: string, tag: string): Promise<ValorantAccount>
// Calls Henrik API /v2/account/{name}/{tag}
// Returns: puuid, name, tag, region

export async function fetchValorantMMR(region: string, name: string, tag: string): Promise<MMRData>
// Calls Henrik API /v2/mmr/{region}/{name}/{tag}
// Returns: current tier, RR, peak rank

export async function fetchValorantMatches(region: string, name: string, tag: string, count: number): Promise<ValorantMatch[]>
// Calls Henrik API /v3/matches/{region}/{name}/{tag}?mode=competitive&size={count}
// Returns: array of match data

// ─── Analysis ───

export function analyzePlayerPerformance(matches: ValorantMatch[], mmr: MMRData): PlayerProfile
// Computes averages across matches: ACS, K/D, ADR, HS%, win rate
// Extracts agent distribution and maps to roles
// Computes composite "overall score"

// ─── Balancing ───

export function generateBalancedTeams(players: PlayerProfile[]): TeamResult
// Brute-force all C(10,5) = 252 combinations
// Score each split, return minimum difference
```

### Data Models

```typescript
interface PlayerProfile {
  riotId: string;          // "Name#Tag"
  rank: string;            // "Diamond 2", "Immortal 1", etc.
  rankScore: number;       // Numeric rank value (Iron1=1 ... Radiant=27)
  avgACS: number;          // Average Combat Score
  avgKD: number;           // Kill/Death ratio
  avgADR: number;          // Average Damage per Round
  hsPercent: number;       // Headshot percentage
  winRate: number;         // Win rate 0-1
  topAgents: AgentStat[];  // Top 3 agents by games played
  roleDistribution: RoleDistribution;
  recentGames: number;     // How many games analyzed
  overallScore: number;    // Composite score for balancing
}

interface AgentStat {
  agent: string;
  games: number;
  winRate: number;
}

interface RoleDistribution {
  duelist: number;     // fraction 0-1
  sentinel: number;
  controller: number;
  initiator: number;
}

interface TeamResult {
  teamA: PlayerProfile[];
  teamB: PlayerProfile[];
  scoreDiff: number;
  roleAnalysis: {
    teamA: RoleDistribution;
    teamB: RoleDistribution;
  };
  alternativeTeams?: TeamResult[]; // top 3 closest splits
}
```

### Balancing Algorithm

```
1. Composite Score Calculation:
   score = (rankScore * 0.35) + (normalizedACS * 0.25) + (kd * 0.20) + (winRate * 0.15) + (hsPercent * 0.05)

   - rankScore: Iron1=1 ... Radiant=27, normalized to 0-1
   - normalizedACS: ACS / 300 (300 is elite-level ACS)
   - kd: capped at 2.0, normalized to 0-1
   - winRate: already 0-1
   - hsPercent: already 0-1 (typically 0.15-0.35)

2. Team Generation:
   - Enumerate all C(10,5) = 252 ways to split 10 players into two teams of 5
   - For each split, compute |sum(teamA.overallScore) - sum(teamB.overallScore)|
   - Sort by score difference ascending
   - Return the best split

3. Role Balance Penalty (optional tiebreaker):
   - For each split, compute role imbalance:
     penalty = abs(teamA.duelists - teamB.duelists) * 0.1
   - Add penalty to scoreDiff
   - This prevents "3 duelist" teams when a more role-balanced split exists with similar skill

4. Performance:
   - 252 iterations with simple arithmetic = sub-millisecond
   - No optimization needed (not NP-hard at n=10)
```

### Agent-to-Role Mapping (hardcoded)

```typescript
const AGENT_ROLES: Record<string, string> = {
  Jett: "duelist", Raze: "duelist", Reyna: "duelist", Phoenix: "duelist",
  Yoru: "duelist", Neon: "duelist", Iso: "duelist", Waylay: "duelist",
  Sage: "sentinel", Killjoy: "sentinel", Cypher: "sentinel", Chamber: "sentinel",
  Deadlock: "sentinel", Vyse: "sentinel",
  Brimstone: "controller", Omen: "controller", Viper: "controller",
  Astra: "controller", Harbor: "controller", Clove: "controller",
  Sova: "initiator", Breach: "initiator", Skye: "initiator",
  KAY/O: "initiator", Fade: "initiator", Gekko: "initiator",
  Tejo: "initiator",
};
```

---

## 4. Frontend Design

### Page: `/valorant`

Layout (single page, no sub-navigation needed):

```
┌─────────────────────────────────────────────┐
│  AppNav (existing)                          │
├─────────────────────────────────────────────┤
│                                             │
│  🎯 Team Balancer                           │
│  ───────────────────────────────            │
│                                             │
│  Region: [NA ▾]                             │
│                                             │
│  ┌──────────────────┐  ┌──────────────────┐ │
│  │ Player 1: [____] │  │ Player 6: [____] │ │
│  │ Player 2: [____] │  │ Player 7: [____] │ │
│  │ Player 3: [____] │  │ Player 8: [____] │ │
│  │ Player 4: [____] │  │ Player 9: [____] │ │
│  │ Player 5: [____] │  │ Player 10:[____] │ │
│  └──────────────────┘  └──────────────────┘ │
│                                             │
│  [ Balance Teams ]   (progress: 3/10...)    │
│                                             │
├─────────────────────────────────────────────┤
│  RESULTS                                    │
│                                             │
│  Team A (Score: 4.82)  │  Team B (Score: 4.79) │
│  ─────────────────────────────────────────  │
│  ┌───────────────┐     │  ┌───────────────┐ │
│  │ 💎 Player1    │     │  │ 💎 Player6    │ │
│  │ ACS: 245      │     │  │ ACS: 238      │ │
│  │ K/D: 1.3      │     │  │ K/D: 1.2      │ │
│  │ Jett, Reyna   │     │  │ Omen, Viper   │ │
│  └───────────────┘     │  └───────────────┘ │
│  ... (5 cards each)    │  ... (5 cards each) │
│                                             │
│  Comparison:                                │
│  Avg ACS:  238 vs 241                       │
│  Avg K/D:  1.25 vs 1.22                     │
│  Roles: 2D/1S/1C/1I vs 1D/2S/1C/1I        │
│  Score diff: 0.03 (very close)              │
│                                             │
└─────────────────────────────────────────────┘
```

### Components

- **PlayerInput**: 10 text inputs with `Name#Tag` format validation (regex: `.+#.+`)
- **ProgressBar**: Shows "Fetching player 3/10..." during API calls
- **TeamCard**: Displays 5 players with rank badge, stats, top agents
- **ComparisonBar**: Side-by-side stat comparison with visual bars
- **RankBadge**: Small component showing rank icon + tier name

### UX Details

- Inputs persist in `localStorage` so players don't re-type names every session
- Region selector defaults to NA, also persisted in `localStorage`
- "Balance Teams" button disabled until all 10 fields filled (or allow 6/8/10)
- Support flexible player counts: 6, 8, or 10 (C(6,3)=20, C(8,4)=70, C(10,5)=252)
- Error handling: if a player can't be found, show inline error on that input
- Partial results: if 9/10 fetch successfully, show error for the 1 failed and let user fix

### Styling

- Reuse existing shadcn/ui components: `Card`, `Input`, `Button`, `Select`, `Badge`
- Dark theme compatible (already global via Tailwind dark mode)
- Rank colors: Iron=gray, Bronze=brown, Silver=silver, Gold=yellow, Plat=teal, Diamond=blue, Ascendant=green, Immortal=red, Radiant=yellow-glow

---

## 5. tRPC Routes

Added to `server/routers.ts` (3 procedures, ~100 lines):

```typescript
// ─── Valorant Team Balancer ───

valorantFetchPlayer: protectedProcedure
  .input(z.object({
    name: z.string().min(1),
    tag: z.string().min(1),
    region: z.enum(["na", "eu", "ap", "kr"]),
  }))
  .mutation(async ({ input }) => {
    // 1. Check cache (memory + DB)
    // 2. If miss: call Henrik API (account + matches + MMR)
    // 3. Analyze performance
    // 4. Cache result (memory 2hr + DB 6hr)
    // 5. Return PlayerProfile
  }),

valorantBalanceTeams: protectedProcedure
  .input(z.object({
    players: z.array(z.object({
      name: z.string(),
      tag: z.string(),
    })).min(6).max(10).refine(arr => arr.length % 2 === 0, "Need even number of players"),
    region: z.enum(["na", "eu", "ap", "kr"]),
  }))
  .mutation(async ({ input }) => {
    // 1. Fetch all players (sequential, 2s gap, with cache)
    // 2. Run balancing algorithm
    // 3. Return TeamResult with top 3 alternatives
  }),

valorantCachedPlayer: protectedProcedure
  .input(z.object({
    name: z.string(),
    tag: z.string(),
  }))
  .query(async ({ input }) => {
    // Return cached PlayerProfile if available, null otherwise
    // Used for instant preview while typing
  }),
```

---

## 6. Estimated Effort

| Task | Hours | Notes |
|------|-------|-------|
| `server/valorant.ts` — API client | 2h | HTTP calls, error handling, rate limiting |
| `server/valorant.ts` — analysis + algorithm | 2h | Score computation, C(n,k) enumeration |
| tRPC routes in `routers.ts` | 1h | Wire up 3 procedures |
| DB migration (cache table) | 0.5h | Optional, can skip for MVP |
| `Valorant.tsx` — input form | 2h | 10 inputs, validation, region selector |
| `Valorant.tsx` — results display | 3h | Team cards, comparison, rank badges |
| Loading states + error handling | 1h | Progress bar, partial failures |
| App.tsx route + lazy import | 0.25h | One line each |
| Testing + polish | 1.5h | Edge cases, mobile layout |
| **Total** | **~13h** | ~2 days of focused work |

### MVP Cut (8h):
Skip: DB persistence (use memory cache only), alternative teams, role balance penalty, rank badge icons. Just get the core flow working: input names, fetch stats, show balanced teams.

---

## 7. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Henrik API goes down / changes** | High | Cache aggressively. Consider self-hosting a fallback or switching to official Riot API if this becomes a core feature. |
| **Rate limits (30/min free tier)** | Medium | Sequential fetching with 2s delay. Cache hits skip API. If needed, upgrade to paid ($5/mo for 100/min). |
| **Private profiles** | Low | Henrik API returns data regardless of in-game privacy settings (it uses Riot's data, not the client). Only truly deleted accounts would fail. |
| **Match history depth** | Low | Henrik API returns up to 20 competitive matches. Enough for meaningful averages. Players with <5 matches get a warning badge. |
| **New agents not in role map** | Low | Default unknown agents to "flex". Update the hardcoded map when new agents release (~2-3 per year). |
| **Uneven player counts** | Low | Support 6/8/10 players. If someone drops, re-balance with remaining even count. |
| **Server restart loses cache** | Low | Memory cache lost, but re-fetching 10 players takes ~40s. DB cache (Layer 2) survives restarts if implemented. |
| **Stale data** | Low | 2-hour cache TTL means stats could be 1-2 games behind. "Refresh" button force-clears cache for a player. |

---

## 8. Future Extensions (Not in Scope)

- **Map-specific balancing**: Weight agent win rates on the selected map
- **Historical tracking**: Track team balance results over time, compare predicted vs actual outcomes
- **Discord integration**: `/balance` slash command that returns team splits in Discord
- **Save presets**: Remember common 10-player groups (e.g., "Friday night 10-man")
- **Custom weights**: Let users adjust the scoring formula (more weight on ACS vs rank)
