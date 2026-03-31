# Valorant Team Balancer - Product Specification

**Feature Type:** New page / tool
**Estimated Time:** 8-12 hours (MVP)
**Dependencies:** Riot Valorant API (VAL-MATCH-V1, VAL-RANKED-V1), Henrik's unofficial Valorant API as fallback

---

## Overview

Users input 10 Valorant player Riot IDs. The app fetches recent match history, computes per-player performance scores, and generates the most balanced 5v5 team split. This is a standalone tool page, not tied to the existing LoL trading/casino system.

---

## 1. User Flow

### 1.1 Input Screen

**Primary input: 10-slot player list**

- 10 text fields, each accepting a Riot ID in `Name#TAG` format
- Paste support: pasting a newline- or comma-separated list of 10 names auto-fills all slots
- Validation: real-time format check (`/^.{3,16}#.{3,5}$/`), red border on invalid
- "Fill from last session" button loads the most recent group from localStorage
- Optional: saved groups dropdown (stored in localStorage, up to 5 groups with editable names)

**Why not autocomplete?** There is no Riot API for player search. Players must type exact Riot IDs. This is fine -- custom lobbies always have people sharing their tags in Discord/chat.

### 1.2 Loading State

Fetching 10 players' data will take **10-30 seconds** depending on rate limits and match history depth.

- Show a progress bar with player-by-player status: "Fetching Player 3/10... (grabbing match history)"
- Each player card transitions from skeleton to populated as their data arrives
- Players are fetched in parallel (up to 3 concurrent to respect rate limits)
- If a player fails (not found, API error), show an inline error on that slot with "Retry" button
- The page remains interactive: users can see partial results while remaining players load

### 1.3 Results Display

Two-column layout (Team A vs Team B):

```
[Team A - Score: 847]          [Team B - Score: 843]
  Player Card                    Player Card
  Player Card                    Player Card
  Player Card                    Player Card
  Player Card                    Player Card
  Player Card                    Player Card

        [Predicted Win: 50.2% - 49.8%]
        [Re-roll] [Swap Mode] [Copy to Clipboard]
```

### 1.4 Interactions

- **Re-roll:** Generate next-best balanced split (cycle through top 5 most balanced combinations)
- **Swap Mode:** Click a player on Team A, then click a player on Team B to swap them. Score difference updates live.
- **Lock players:** Lock a player to a specific team before re-rolling (e.g., "I want to play with my duo")
- **Copy to clipboard:** Formatted text output for pasting into Discord

### 1.5 Data Caching

- Cache fetched player data in server-side memory (same `cache.ts` pattern) with 15-minute TTL
- On re-visit, if cached data exists, skip the loading phase and go straight to results
- localStorage stores the last 5 groups of 10 player names for quick re-use

---

## 2. API Strategy

### 2.1 The Valorant API Problem

Riot's official Valorant API is **extremely limited** for third-party developers:
- `VAL-MATCH-V1` only returns competitive match history for the **API key owner's region**
- There is **no public endpoint** for arbitrary player match history (unlike LoL)
- RSO (Riot Sign-On) could work but requires each player to auth -- impractical for 10 players

### 2.2 Recommended Approach: Henrik's Unofficial API

Use [Henrik's Valorant API](https://docs.henrikdev.xyz/) (free tier: 30 req/min, paid: 90 req/min):

| Endpoint | Data | Rate Cost |
|----------|------|-----------|
| `GET /v2/account/{name}/{tag}` | Account info, region, level | 1 req |
| `GET /v3/mmr/{region}/{name}/{tag}` | Current rank, RR, peak rank, rank history | 1 req |
| `GET /v4/matches/{region}/{name}/{tag}?mode=competitive&size=20` | Recent match list with full stats | 1 req |

**Per player: 3 requests. For 10 players: 30 requests.** Fits within free tier if sequential, or paid tier if parallel.

### 2.3 Fallback: Tracker.gg Scraping

Not recommended for production, but as a last resort, scrape tracker.gg profile pages. This is fragile and violates ToS. Use Henrik's API.

### 2.4 Server Implementation

New file: `server/valorantApi.ts`

```typescript
// Core types
interface ValorantPlayer {
  name: string;
  tag: string;
  region: string;
  currentRank: string;       // e.g. "Diamond 2"
  currentRR: number;         // 0-100
  peakRank: string;
  level: number;
}

interface ValorantMatchStats {
  matchId: string;
  map: string;
  mode: string;
  agent: string;
  score: number;             // ACS (Average Combat Score)
  kills: number;
  deaths: number;
  assists: number;
  adr: number;               // Average Damage per Round
  headshot_pct: number;
  firstBloods: number;
  clutches: number;
  roundsPlayed: number;
  won: boolean;
  date: number;              // timestamp
}

interface PlayerProfile {
  player: ValorantPlayer;
  recentMatches: ValorantMatchStats[];  // last 20-50 competitive games
  aggregated: AggregatedStats;          // computed from matches
}

interface AggregatedStats {
  avgACS: number;
  avgKD: number;
  avgADR: number;
  winRate: number;
  hsPercent: number;
  avgFirstBloods: number;    // per game
  topAgents: { agent: string; games: number; winRate: number }[];
  primaryRole: "duelist" | "initiator" | "controller" | "sentinel";
  gamesPlayed: number;
  rankScore: number;         // numeric rank value (Iron 1 = 0, Radiant = 27)
}
```

---

## 3. Balancing Algorithm

### 3.1 Player Score Formula

Each player gets a composite score from 0-100:

```
PlayerScore = (
    0.30 * normalize(avgACS, 100, 350)      // Combat effectiveness
  + 0.20 * normalize(avgKD, 0.5, 2.5)       // Fragging power
  + 0.20 * normalize(avgADR, 80, 220)       // Damage output
  + 0.15 * normalize(winRate, 0.3, 0.7)     // Winning tendency
  + 0.10 * normalize(rankScore, 0, 27)      // Current rank (Iron1=0, Radiant=27)
  + 0.05 * normalize(hsPercent, 0.10, 0.35) // Mechanical aim
)

where normalize(value, min, max) = clamp((value - min) / (max - min), 0, 1) * 100
```

**Weight rationale:**
- ACS (30%): Best single indicator of in-game impact, accounts for kills, damage, and utility
- K/D (20%): Raw fragging power, important for team fights
- ADR (20%): Consistent damage output, less variance than K/D
- Win rate (15%): Captures intangibles like comms, team play, clutch factor
- Rank (10%): Baseline skill floor, but can be outdated so lower weight
- HS% (5%): Mechanical precision, slight tiebreaker

### 3.2 Recency Weighting

More recent games count more. Apply exponential decay to each match before averaging:

```
weight(match) = 0.95 ^ (index)  // index 0 = most recent, index 19 = oldest
// Most recent game: weight 1.0
// 10th game: weight 0.60
// 20th game: weight 0.36
```

### 3.3 Role Classification

Classify each player's primary role from their most-played agents:

| Role | Agents |
|------|--------|
| Duelist | Jett, Reyna, Raze, Yoru, Phoenix, Neon, Iso |
| Initiator | Sova, Breach, Skye, KAY/O, Fade, Gekko |
| Controller | Brimstone, Omen, Viper, Astra, Harbor, Clove |
| Sentinel | Sage, Cypher, Killjoy, Chamber, Deadlock, Vyse |

Primary role = role of their most-played agent across recent matches. Secondary role = second most played.

### 3.4 Team Generation Algorithm

**Step 1: Enumerate all possible splits**

10 choose 5 = 252 unique team combinations. This is small enough to brute-force every split.

**Step 2: Score each split on two axes**

```typescript
function scoreSplit(teamA: Player[], teamB: Player[]): number {
  const scoreA = sum(teamA.map(p => p.score));
  const scoreB = sum(teamB.map(p => p.score));
  const scoreDiff = Math.abs(scoreA - scoreB);

  const roleA = countRoles(teamA);
  const roleB = countRoles(teamB);
  const rolePenalty = roleImbalancePenalty(roleA, roleB);

  return scoreDiff + rolePenalty * 5;  // role imbalance costs 5 points per violation
}
```

**Role imbalance penalty:**
- Each team should ideally have 1-2 duelists, 1-2 initiators, 1 controller, 1 sentinel
- Penalty of 1 for each role that has 0 players or 3+ players on a team
- Penalty of 0.5 if one team has all the duelists

**Step 3: Rank splits and pick top 5**

Sort all 252 splits by combined score. Store top 5 for re-roll cycling.

### 3.5 Predicted Win Probability

Simple logistic estimate based on score differential:

```
winProbA = 1 / (1 + 10^((scoreB - scoreA) / 50))
```

For well-balanced teams, this should hover around 48-52%. Display as a bar chart.

---

## 4. Display Design

### 4.1 Player Card

```
+------------------------------------------+
| [Agent Icon]  PlayerName#TAG             |
| Diamond 2 (78 RR)         ACS: 245      |
| K/D: 1.42    ADR: 168     HS%: 28%      |
| Top Agents: Jett (34g), Chamber (12g)   |
| Role: Duelist              Score: 72.4   |
+------------------------------------------+
```

- Agent icon = their most-played agent
- Rank badge with colored tier indicator
- Compact stat row with the key metrics
- Score shown in bottom right with color coding (green = high, yellow = mid, red = low)

### 4.2 Team Summary Panel

Each team gets a summary bar:

```
Team A — Total Score: 347.2
  Roles: 2 Duelist, 1 Init, 1 Ctrl, 1 Sent
  Avg ACS: 231 | Avg K/D: 1.28 | Win Rate: 54%
```

### 4.3 Comparison View

Center panel between the two teams:

```
         Team A    |    Team B
Score:    347.2    |    344.8
Avg ACS:  231     |     228
Avg K/D:  1.28    |     1.25
Win%:     54%     |     52%

   Win Probability: 50.8% - 49.2%
   [========|=======]
```

### 4.4 Mobile Layout

Stack teams vertically. Team A on top, comparison bar in middle, Team B below. Player cards go single-column.

---

## 5. Server Implementation

### 5.1 New Files

| File | Purpose |
|------|---------|
| `server/valorantApi.ts` | Henrik API client, types, data fetching |
| `server/teamBalancer.ts` | Scoring formula, team split algorithm |
| `client/src/pages/TeamBalancer.tsx` | Main page component |
| `client/src/components/ValorantPlayerCard.tsx` | Individual player stat card |
| `client/src/components/TeamColumn.tsx` | Team display with summary |

### 5.2 tRPC Endpoints (add to `server/routers.ts`)

```typescript
// Fetch a single Valorant player's profile + recent stats
valorant.getPlayer: publicProcedure
  .input(z.object({ name: z.string(), tag: z.string() }))
  .query(async ({ input }) => { ... })

// Fetch 10 players and compute balanced teams
valorant.balanceTeams: publicProcedure
  .input(z.object({
    players: z.array(z.object({ name: z.string(), tag: z.string() })).length(10),
    lockedTeams: z.record(z.string(), z.enum(["A", "B"])).optional(),
  }))
  .query(async ({ input }) => { ... })
```

### 5.3 Rate Limiting Strategy

Henrik free tier: 30 req/min. 10 players x 3 endpoints = 30 requests.

- Fetch players in batches of 3 (9 requests), wait 20 seconds, next batch
- Total time: ~40 seconds worst case for free tier
- With paid tier ($5/mo, 90 req/min): all 30 requests in ~20 seconds
- Server-side cache (15 min TTL) means subsequent balances with same players are instant

### 5.4 Environment Variables

```
HENRIK_API_KEY=HDEV-xxxx-xxxx-xxxx    # Henrik Valorant API key
```

---

## 6. Scope & Milestones

### MVP (v1) — 8-12 hours

- [ ] `valorantApi.ts` - Henrik API client with caching
- [ ] `teamBalancer.ts` - Scoring formula + brute-force 252-combination split
- [ ] tRPC endpoints for single player fetch and team balance
- [ ] `TeamBalancer.tsx` page with 10-slot input form
- [ ] Loading state with per-player progress
- [ ] Results display with two team columns and comparison
- [ ] Re-roll through top 5 balanced splits
- [ ] Add route to nav (under a "Tools" section or alongside existing pages)

### v2 — 4-6 hours

- [ ] Swap mode (click players to swap between teams)
- [ ] Lock players to teams before balancing
- [ ] Saved groups in localStorage (name + 10 player IDs)
- [ ] Copy-to-clipboard formatted output for Discord
- [ ] Agent role icons and rank badge images
- [ ] Match history detail view per player (expandable card)

### v3 — Future

- [ ] Discord bot command: `/balance @player1 @player2 ... @player10`
- [ ] Track custom match results: after playing, input the score and build a local ELO system
- [ ] "Rematch" mode: re-balance based on how the last game went
- [ ] Map-specific balancing (some players perform better on certain maps)
- [ ] Party detection: identify players who frequently queue together and optionally keep/split them

---

## 7. Open Questions

1. **Auth required?** MVP should be public (no login needed). Casino/trading features require auth, but team balancer is a standalone utility.

2. **Henrik API reliability?** It's unofficial and could go down. Should we build a fallback? For MVP, just show a clear error message. For v2, consider caching player data in SQLite so previously-seen players always have some data.

3. **Region support?** Henrik's API requires a region (`na`, `eu`, `ap`, `kr`). MVP defaults to NA (matching the existing LoL tracker audience). Add region selector in v2.

4. **10-player minimum?** Should we support fewer players (e.g., 6 for 3v3, 8 for 4v4)? MVP enforces exactly 10. Easy to generalize later.

5. **Where in nav?** Options: (a) new top-level "Valorant" nav item, (b) under "Tools" dropdown, (c) standalone URL only (`/team-balancer`). Recommend (a) since it's a distinct product surface from the LoL tracker.
