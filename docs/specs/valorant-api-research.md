# Valorant API Research

> Research date: 2026-03-26
> Purpose: Evaluate APIs for building a team balancer that ingests 10 players' stats

---

## 1. Official Riot Valorant API

**Portal:** https://developer.riotgames.com

### Authentication & Key Types

| Key Type | Access | Rate Limit | Notes |
|----------|--------|------------|-------|
| Development Key | Personal use, expires every 24h | 20 req/sec, 100 req/2min | Auto-issued on signup |
| Production Key | Approved apps | Higher (negotiated) | Requires application review, takes weeks |
| RSO (Riot Sign-On) | OAuth2 for user auth | Varies | Needed for some endpoints |

### Available Endpoints

#### VAL-CONTENT-V1
- `GET /val/content/v1/contents` -- Game content (agents, maps, modes, etc.)
- No player data, just game metadata.

#### VAL-MATCH-V1
- `GET /val/match/v1/matches/{matchId}` -- Full match details by match ID
- `GET /val/match/v1/matchlists/by-puuid/{puuid}` -- Match history for a player (by PUUID)
- `GET /val/match/v1/recent-matches/by-queue/{queue}` -- Recent match IDs for a queue

#### VAL-RANKED-V1
- `GET /val/ranked/v1/leaderboards/by-act/{actId}` -- Ranked leaderboard for an act
- Only returns top ~15,000 players (Immortal+ only)
- **Does NOT return rank/RR for players below Immortal**

#### VAL-STATUS-V1
- `GET /val/status/v1/platform-data` -- Server status

#### ACCOUNT-V1 (Shared across Riot games)
- `GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}` -- Resolve Riot ID to PUUID
- `GET /riot/account/v1/accounts/by-puuid/{puuid}` -- Get Riot ID from PUUID

### Match Data Fields (VAL-MATCH-V1)

Each match object contains:

```
matchInfo:
  matchId, mapId, gameMode, gameLengthMillis, isCompleted,
  isRanked, seasonId, queueId, provisioningFlowId

players[]:
  puuid, gameName, tagLine, teamId, partyId,
  characterId (agent UUID),
  competitiveTier (numeric rank at time of match),
  stats:
    score, roundsPlayed, kills, deaths, assists,
    playtimeMillis, abilityCasts (grenade, ability1, ability2, ultimate)

roundResults[]:
  roundNum, roundResult, roundCeremony,
  winningTeam, plantRoundTime, defuseRoundTime,
  playerStats[]:
    puuid, kills[] (each with killer, victim, damageType, finishingDamage),
    damage[] (receiver, damage, legshots, bodyshots, headshots),
    score, economy (loadoutValue, weapon, armor, remaining, spent),
    ability (grenadeEffects, ability1Effects, ability2Effects, ultimateEffects)

teams[]:
  teamId, won, roundsPlayed, roundsWon, numPoints
```

### What the Official API CAN Provide
- Full kill/death/assist data per round
- Damage breakdown (headshots, bodyshots, legshots) per round
- Economy data per round
- Agent played
- Map played
- Win/loss
- ACS can be CALCULATED from (score / roundsPlayed)
- ADR can be CALCULATED from damage arrays
- Headshot % can be CALCULATED from shot distribution
- Competitive tier at time of match

### What the Official API CANNOT Provide
- Current rank/RR for players below Immortal (no endpoint exists)
- MMR / hidden MMR
- Career stats aggregates (you must compute from match history)
- Match history is limited (~20 most recent matches via matchlist endpoint)
- No direct "player stats" summary endpoint

### Rate Limits (Development Key)
- 20 requests per second
- 100 requests per 2 minutes
- Per region

### Regions
| Region Code | Coverage |
|-------------|----------|
| `na` | North America |
| `eu` | Europe |
| `ap` | Asia Pacific |
| `kr` | Korea |
| `br` | Brazil |
| `latam` | Latin America |

### Critical Limitations
1. **No rank endpoint for most players** -- The ranked leaderboard only covers Immortal+
2. **Limited match history** -- matchlist returns ~20 recent matches, not 100
3. **Development keys expire daily** -- You must regenerate every 24h
4. **Production key approval is slow** -- Weeks to months, and they may reject
5. **No aggregate stats** -- Must fetch individual matches and compute

---

## 2. Third-Party APIs

### Henrik's Unofficial Valorant API (api.henrikdev.xyz)

**The most popular community API.** Acts as a proxy/wrapper around Riot's internal APIs.

**Docs:** https://docs.henrikdev.xyz

#### Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /valorant/v2/account/{name}/{tag}` | Account lookup (PUUID, region, level, card) |
| `GET /valorant/v3/matches/{region}/{name}/{tag}` | Last 5 matches with full details |
| `GET /valorant/v4/matches/{region}/{platform}/{name}/{tag}?mode=competitive&size=10` | Match history (v4, up to ~10 per request) |
| `GET /valorant/v2/mmr/{region}/{name}/{tag}` | Current rank, RR, rank history |
| `GET /valorant/v3/mmr/{region}/{platform}/{name}/{tag}` | Enhanced MMR with act history |
| `GET /valorant/v1/mmr-history/{region}/{name}/{tag}` | MMR change history (per game) |
| `GET /valorant/v1/lifetime/matches/{region}/{name}/{tag}` | Lifetime match history (paginated) |
| `GET /valorant/v1/stored-matches/{region}/{name}/{tag}` | Stored/cached matches |
| `GET /valorant/v1/leaderboard/{region}` | Regional leaderboard |
| `GET /valorant/v1/premier/{team_name}/{team_tag}` | Premier team data |

#### MMR/Rank Data Returns
```json
{
  "currenttier": 21,
  "currenttierpatched": "Diamond 3",
  "ranking_in_tier": 67,
  "mmr_change_to_last_game": -14,
  "elo": 1867,
  "images": { "small": "...", "large": "...", "triangle_down": "..." }
}
```

#### Match Data Returns (per player per match)
- Agent, map, mode, game start time, game length
- kills, deaths, assists, score
- bodyshots, headshots, legshots (raw counts)
- damage_made, damage_received
- ACS (score / rounds)
- ability_casts
- economy per round
- Full round-by-round data

#### Rate Limits
| Tier | Limit | Cost |
|------|-------|------|
| Free | 30 req/min | Free |
| Tier 1 | 90 req/min | ~$5/mo (donation) |
| Tier 2 | 180 req/min | ~$10/mo |
| Tier 3+ | Higher | More |

API key passed via `Authorization` header.

#### Advantages Over Official API
- **Returns current rank/RR for ALL players** (not just Immortal+)
- Provides computed ELO number
- Match history goes deeper than official API
- No need for RSO / production key approval
- Simpler endpoint structure (name#tag instead of PUUID)
- Lifetime match data available

#### Disadvantages
- Unofficial -- could break or shut down
- Rate limits are stricter on free tier
- Data depends on Henrik's infrastructure staying up
- Some endpoints may have stale data

### tracker.gg

- **No public API.** tracker.gg does not offer a documented public API for third-party developers.
- They show stats on their website but scraping is against TOS.
- Previously had an API program but it was discontinued/severely restricted.
- Not a viable option.

### blitz.gg

- **No public API.** Blitz is a desktop overlay app.
- They use Riot's API internally but don't expose endpoints.
- Not a viable option.

### valorant-api.com

- This is a **game assets API only** (agent images, weapon skins, maps, etc.)
- No player data whatsoever.
- Useful for UI (agent icons, rank icons) but not for stats.

---

## 3. Data Available Per Player (for Team Balance)

### Directly Available (via Henrik API or computed from match data)

| Stat | Source | Notes |
|------|--------|-------|
| **Rank / Tier** | Henrik MMR endpoint | Numeric tier (0-27) + RR |
| **RR (Rating Points)** | Henrik MMR endpoint | 0-100 within tier |
| **ELO (computed)** | Henrik MMR endpoint | Single number, great for balancing |
| **ACS** | Computed from matches | score / roundsPlayed per match |
| **ADR** | Computed from matches | total_damage / roundsPlayed |
| **K/D Ratio** | Computed from matches | kills / deaths |
| **Headshot %** | Computed from matches | headshots / (headshots + bodyshots + legshots) |
| **Win Rate** | Computed from matches | wins / total_games |
| **Agent Pool** | From match history | Which agents played, frequency |
| **Role Distribution** | Derived from agents | Map agent -> role (duelist/sentinel/controller/initiator) |
| **First Blood Rate** | From round data | Count first kills per round / total rounds |
| **KAST %** | From round data | Rounds with Kill/Assist/Survived/Traded / total rounds |
| **Clutch Rate** | From round data | Requires analyzing 1vN situations in round data |
| **Economy Rating** | From economy data | Damage per credit spent |

### Stat Computation Approach

For a team balancer, fetch the last N matches (10-20 is practical) and compute rolling averages:

```
For each player:
  1. GET /valorant/v2/mmr/{region}/{name}/{tag}     -> rank, RR, elo
  2. GET /valorant/v3/matches/{region}/{name}/{tag}  -> last 5 matches
     (or v4 with size=10 for more)

  From matches, compute:
  - avg_acs = mean(score / roundsPlayed) across matches
  - avg_adr = mean(totalDamage / roundsPlayed) across matches
  - kd_ratio = sum(kills) / sum(deaths) across matches
  - hs_pct = sum(headshots) / sum(headshots + bodyshots + legshots)
  - win_rate = wins / total_matches
  - agent_pool = set of agents played
  - role_dist = { duelist: X%, controller: Y%, ... }
```

---

## 4. Challenges

### Region Handling
- Must know each player's region (na, eu, ap, kr, br, latam)
- Account lookup can auto-detect region, but match/MMR endpoints need it
- Henrik's account endpoint returns `region` in the response -- use this

### Riot ID Format
- Format: `Name#Tag` (e.g., `TenZ#0505`)
- Name can have spaces, special characters, unicode
- Tag is 3-5 alphanumeric characters
- URL encoding needed for special characters in names

### Rate Limiting Considerations
For 10 players in a custom game lobby:
- 10 account lookups = 10 requests
- 10 MMR lookups = 10 requests
- 10 match history fetches = 10 requests
- **Total: ~30 requests minimum**
- Free tier (30/min) can handle this in ~1 minute
- Tier 1 (90/min) handles it in one burst

### Data Freshness
- MMR data is near-real-time (updates after each game)
- Match data appears within minutes of game ending
- Henrik API may cache responses for a few minutes
- For a pre-game balancer, this freshness is more than sufficient

### Private Profiles / Data Availability
- Riot does not have "private profiles" for API access -- all match data is accessible via PUUID
- Henrik API works for all accounts that have played Valorant
- Some very new or inactive accounts may have no match data
- Console (Xbox/PS) accounts may need `platform=console` parameter in v4 endpoints

---

## 5. Recommendation

### Primary API: Henrik's Unofficial Valorant API

**Why:**
1. **Provides rank/RR/ELO for all players** -- The official API only covers Immortal+ leaderboards. For a team balancer, you need rank data for all skill levels.
2. **Simpler authentication** -- Just a free API key, no Riot production key approval needed.
3. **Name#Tag lookups** -- Players can enter their Riot ID directly; no need to resolve PUUIDs first.
4. **Match data is comprehensive** -- Full per-round breakdown including damage, economy, abilities.
5. **Battle-tested** -- Used by many community tools and Discord bots.

### Supplementary: valorant-api.com (for game assets)
- Agent icons, rank icons, map images for UI display.
- Completely free, no auth needed.

### Fastest Path to 10 Players' Data

```
Step 1: Get API key from https://dash.henrikdev.xyz (free)

Step 2: For each player (Name#Tag):
  a) GET /valorant/v2/account/{name}/{tag}
     -> puuid, region, level

  b) GET /valorant/v2/mmr/{region}/{name}/{tag}
     -> current_rank, rr, elo (SINGLE NUMBER -- best for balancing)

  c) GET /valorant/v3/matches/{region}/{name}/{tag}?mode=competitive
     -> last 5 competitive matches with full stats

Step 3: Compute per-player:
  - elo (directly from MMR endpoint)
  - avg_acs, avg_adr, kd, hs% (from match data)
  - agent_pool, role_distribution (from match data)

Step 4: Balance teams using weighted composite score:
  - Primary: ELO (most reliable single metric)
  - Secondary: ACS, ADR, K/D (performance metrics)
  - Tertiary: Role distribution (ensure team comp balance)

Total API calls: 30 (3 per player x 10 players)
Time at free tier: ~60 seconds
Time at Tier 1: ~20 seconds
```

### Recommended Balance Algorithm Input

For each player, construct a profile:
```typescript
interface PlayerProfile {
  riotId: string;           // "Name#Tag"
  region: string;           // "na", "eu", etc.
  elo: number;              // From Henrik MMR (single number, ~0-2500+)
  rank: string;             // "Diamond 3" etc.
  rr: number;               // 0-100 within rank
  avgAcs: number;           // Average Combat Score (last N matches)
  avgAdr: number;           // Average Damage per Round
  kdRatio: number;          // Kill/Death ratio
  hsPercent: number;        // Headshot percentage (0-100)
  winRate: number;          // Win rate (0-1)
  topAgents: string[];      // Most played agents
  primaryRole: string;      // Most played role
  matchesAnalyzed: number;  // How many matches went into these stats
}
```

**ELO alone is often sufficient** for basic team balancing. It already encodes win/loss history and opponent strength. The additional stats (ACS, ADR, etc.) are useful for:
- Tiebreaking when ELOs are similar
- Identifying smurfs (high ACS/ADR but low rank)
- Role-based balancing (ensuring each team has controller/duelist/etc.)

---

## Appendix: Rank Tier Numbers

| Tier | Rank |
|------|------|
| 0-2 | Unranked |
| 3 | Iron 1 |
| 4 | Iron 2 |
| 5 | Iron 3 |
| 6 | Bronze 1 |
| 7 | Bronze 2 |
| 8 | Bronze 3 |
| 9 | Silver 1 |
| 10 | Silver 2 |
| 11 | Silver 3 |
| 12 | Gold 1 |
| 13 | Gold 2 |
| 14 | Gold 3 |
| 15 | Platinum 1 |
| 16 | Platinum 2 |
| 17 | Platinum 3 |
| 18 | Diamond 1 |
| 19 | Diamond 2 |
| 20 | Diamond 3 |
| 21 | Ascendant 1 |
| 22 | Ascendant 2 |
| 23 | Ascendant 3 |
| 24 | Immortal 1 |
| 25 | Immortal 2 |
| 26 | Immortal 3 |
| 27 | Radiant |

## Appendix: Agent Role Mapping

| Role | Agents |
|------|--------|
| Duelist | Jett, Reyna, Raze, Phoenix, Yoru, Neon, Iso, Waylay |
| Controller | Brimstone, Omen, Viper, Astra, Harbor, Clove |
| Initiator | Sova, Breach, Skye, KAY/O, Fade, Gekko, Tejo |
| Sentinel | Sage, Cypher, Killjoy, Chamber, Deadlock, Vyse |
