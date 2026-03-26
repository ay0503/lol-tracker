# Valorant Team Balancer - UI Design Specification

**Date:** 2026-03-26
**Feature:** 5v5 Team Balancer for $DORI LP Tracker
**Route:** `/valorant/team-balancer`

---

## 1. Page Layout

The page has two distinct phases: **Input** and **Results**. The transition between them is a smooth vertical slide -- the input form compresses upward into a summary bar while the results expand below.

---

### 1.1 Input Phase

```
+------------------------------------------------------------------+
|  NAV BAR                                          [Theme Toggle]  |
+------------------------------------------------------------------+
|                                                                    |
|              VALORANT TEAM BALANCER                                |
|              Balance 10 players into fair 5v5 teams                |
|                                                                    |
|  +-----------------------------+  +-----------------------------+  |
|  |  TEAM SLOT 1                |  |  TEAM SLOT 6                |  |
|  |  [  Player#TAG          ]   |  |  [  Player#TAG          ]   |  |
|  |  ( ) empty                  |  |  ( ) empty                  |  |
|  +-----------------------------+  +-----------------------------+  |
|  |  TEAM SLOT 2                |  |  TEAM SLOT 7                |  |
|  |  [  Player#TAG          ]   |  |  [  Player#TAG          ]   |  |
|  |  ( ) empty                  |  |  ( ) empty                  |  |
|  +-----------------------------+  +-----------------------------+  |
|  |  TEAM SLOT 3                |  |  TEAM SLOT 8                |  |
|  |  [  Player#TAG          ]   |  |  [  Player#TAG          ]   |  |
|  |  ( ) empty                  |  |  ( ) empty                  |  |
|  +-----------------------------+  +-----------------------------+  |
|  |  TEAM SLOT 4                |  |  TEAM SLOT 9                |  |
|  |  [  Player#TAG          ]   |  |  [  Player#TAG          ]   |  |
|  |  ( ) empty                  |  |  ( ) empty                  |  |
|  +-----------------------------+  +-----------------------------+  |
|  |  TEAM SLOT 5                |  |  TEAM SLOT 10               |  |
|  |  [  Player#TAG          ]   |  |  [  Player#TAG          ]   |  |
|  |  ( ) empty                  |  |  ( ) empty                  |  |
|  +-----------------------------+  +-----------------------------+  |
|                                                                    |
|  Region: [NA v]    [Paste 10 Names]    [Clear All]                |
|                                                                    |
|  +--------------------------------------------------------------+  |
|  |              BALANCE TEAMS                                    |  |
|  |              (requires 10 players)                            |  |
|  +--------------------------------------------------------------+  |
|                                                                    |
+--------------------------------------------------------------------+
```

#### Input Field States

Each player input has a status icon to its right:

| State    | Icon          | Tailwind Classes                                     |
|----------|---------------|------------------------------------------------------|
| Empty    | Circle outline| `text-muted-foreground/40`                           |
| Typing   | Pulsing dot   | `text-yellow-400 animate-pulse`                      |
| Loading  | Spinner       | `text-blue-400 animate-spin`                         |
| Found    | Check circle  | `text-emerald-400`                                   |
| Error    | X circle      | `text-red-400`                                       |

#### Input Field Behavior

- Auto-validate on blur (debounced 500ms after typing stops)
- When a player is found, show a mini preview below the input: rank icon + current RR
- Tab order flows down columns: 1-5 then 6-10
- Pressing Enter in any field moves focus to the next empty field

#### Quick Fill Modal

Clicking "Paste 10 Names" opens a modal with a `<textarea>` where users paste newline-separated Riot IDs. On submit, all 10 fields populate simultaneously and validation begins in parallel.

```
+--------------------------------------+
|  Paste Player Names                  |
|  (one per line, format: Name#TAG)    |
|                                      |
|  +--------------------------------+  |
|  | TenZ#0505                      |  |
|  | Aspas#BR1                      |  |
|  | yay#NA1                        |  |
|  | ...                            |  |
|  +--------------------------------+  |
|                                      |
|  [Cancel]              [Fill Slots]  |
+--------------------------------------+
```

#### Loading State (Fetching Players)

When "Balance Teams" is pressed:

```
+--------------------------------------------------------------+
|                                                                |
|     Fetching player data...                                    |
|     [=======>                    ]  3/10 players               |
|                                                                |
|     TenZ#0505        [check] Radiant - 487 RR                 |
|     Aspas#BR1         [check] Immortal 3 - 302 RR             |
|     yay#NA1           [spin]  Fetching...                      |
|     Player4#TAG       [ ]     Queued                           |
|     ...                                                        |
|                                                                |
+--------------------------------------------------------------+
```

---

### 1.2 Results Phase - Desktop

```
+------------------------------------------------------------------+
|  NAV BAR                                          [Theme Toggle]  |
+------------------------------------------------------------------+
|  [< Edit Players]        TEAM BALANCER RESULTS                    |
+------------------------------------------------------------------+
|                                                                    |
|  +-- TEAM ALPHA (Blue) -------+  +-- TEAM BRAVO (Red) --------+  |
|  |  Predicted Win: 52%        |  |  Predicted Win: 48%         |  |
|  |  Avg ACS: 245              |  |  Avg ACS: 238               |  |
|  |                            |  |                              |  |
|  |  +----------------------+  |  |  +----------------------+   |  |
|  |  | [Radiant] TenZ#0505 |  |  |  | [Imm3] Aspas#BR1    |   |  |
|  |  | ACS 289 K/D 1.34    |  |  |  | ACS 276 K/D 1.28    |   |  |
|  |  | ADR 168  HS% 28.1   |  |  |  | ADR 159  HS% 31.2   |   |  |
|  |  | Jett Raze Chamber    |  |  |  | Jett Reyna Neon      |   |  |
|  |  | [Duelist]   WR 54%   |  |  |  | [Duelist]   WR 56%   |   |  |
|  |  +----------------------+  |  |  +----------------------+   |  |
|  |  +----------------------+  |  |  +----------------------+   |  |
|  |  | [Dia2] Player2#TAG  |  |  |  | [Dia1] Player7#TAG   |   |  |
|  |  | ACS 221 K/D 1.12    |  |  |  | ACS 215 K/D 1.08    |   |  |
|  |  | ...                  |  |  |  | ...                   |   |  |
|  |  +----------------------+  |  |  +----------------------+   |  |
|  |  ...3 more cards...        |  |  ...3 more cards...         |  |
|  +----------------------------+  +------------------------------+  |
|                                                                    |
|  +--------------------------------------------------------------+  |
|  |                TEAM COMPARISON                                |  |
|  |                                                               |  |
|  |  Predicted Win   [====ALPHA 52%====|===BRAVO 48%===]         |  |
|  |  Avg ACS         245 [=========|=======] 238                  |  |
|  |  Avg K/D         1.18 [========|========] 1.14                |  |
|  |  Avg ADR         152 [========|=========] 148                  |  |
|  |  Avg HS%         24.3% [======|=========] 25.1%               |  |
|  |                                                               |  |
|  |  ROLE COMPOSITION                                             |  |
|  |  Alpha: 1 Duelist | 1 Controller | 1 Sentinel | 2 Initiator |  |
|  |  Bravo: 2 Duelist | 1 Controller | 1 Sentinel | 1 Initiator |  |
|  +--------------------------------------------------------------+  |
|                                                                    |
|  [Re-balance]  [Randomize]  [Copy to Discord]                    |
|                                                                    |
+--------------------------------------------------------------------+
```

### 1.3 Results Phase - Mobile

```
+----------------------------+
|  NAV                       |
+----------------------------+
|  [< Edit]  RESULTS         |
+----------------------------+
|                              |
|  [TEAM ALPHA] [TEAM BRAVO]  |  <-- tab switcher
|                              |
|  TEAM ALPHA (Blue)           |
|  Win: 52%  |  Avg ACS: 245  |
|                              |
|  +------------------------+  |
|  | [Rad] TenZ#0505        |  |
|  | ACS 289  K/D 1.34      |  |
|  | Jett Raze Chamber      |  |
|  | Duelist       WR 54%   |  |
|  +------------------------+  |
|  +------------------------+  |
|  | [Dia2] Player2#TAG     |  |
|  | ACS 221  K/D 1.12      |  |
|  | ...                     |  |
|  +------------------------+  |
|  ...3 more...                |
|                              |
|  +------------------------+  |
|  |  COMPARISON             |  |
|  |  Win:  52% vs 48%       |  |
|  |  ACS:  245 vs 238       |  |
|  |  K/D:  1.18 vs 1.14     |  |
|  +------------------------+  |
|                              |
|  [Re-balance] [Copy]        |
|                              |
+------------------------------+
```

On mobile, teams are viewed via a tab switcher (swipeable). The comparison section collapses into a compact table below the active team.

---

## 2. Player Stat Card - Detailed Design

### Compact View (Default)

```
+--------------------------------------------------+
|  [Rank Badge]  PlayerName#TAG           [Expand]  |
|                                                    |
|  ACS  289   |   K/D  1.34   |   ADR  168          |
|  HS%  28.1% |   WR   54%    |                      |
|                                                    |
|  [Jett icon] [Raze icon] [Chamber icon]            |
|  Primary Role: Duelist                              |
+--------------------------------------------------+
```

### Expanded View (Click to Expand)

```
+--------------------------------------------------+
|  [Rank Badge]  PlayerName#TAG          [Collapse]  |
|  Radiant - 487 RR                                  |
|                                                    |
|  +----------------------------------------------+  |
|  |  COMBAT STATS                                 |  |
|  |  ACS   289   |  ADR    168   |  KAST  74.2%   |  |
|  |  K/D   1.34  |  HS%    28.1% |  FK/D  +12     |  |
|  +----------------------------------------------+  |
|  |  AGENT POOL                                   |  |
|  |  Jett     (142 games, 56% WR)                 |  |
|  |  Raze     (87 games, 52% WR)                  |  |
|  |  Chamber  (64 games, 54% WR)                  |  |
|  +----------------------------------------------+  |
|  |  RECENT FORM (Last 20 games)                  |  |
|  |  WR: 65%  Avg ACS: 302  Trend: UP             |  |
|  +----------------------------------------------+  |
+--------------------------------------------------+
```

---

## 3. Rank Badge Design

| Rank       | Color           | Tailwind BG               | Tailwind Text           | Badge Shape   |
|------------|-----------------|---------------------------|-------------------------|---------------|
| Iron       | #6B6B6B (gray)  | `bg-zinc-500`             | `text-zinc-200`         | Circle        |
| Bronze     | #A5713E (brown) | `bg-amber-700`            | `text-amber-200`        | Circle        |
| Silver     | #C0C0C0 (silver)| `bg-slate-400`            | `text-slate-900`        | Circle        |
| Gold       | #EAB308 (gold)  | `bg-yellow-500`           | `text-yellow-950`       | Circle        |
| Platinum   | #3B9EBF (teal)  | `bg-cyan-600`             | `text-cyan-100`         | Circle        |
| Diamond    | #B967FF (purple)| `bg-purple-500`           | `text-purple-100`       | Diamond shape |
| Ascendant  | #2DD4BF (green) | `bg-emerald-400`          | `text-emerald-950`      | Chevron up    |
| Immortal   | #EF4444 (red)   | `bg-red-500`              | `text-red-100`          | Shield        |
| Radiant    | #FBBF24 (gold)  | `bg-gradient-to-r from-yellow-400 to-amber-500` | `text-yellow-950` | Star / shimmer |

Radiant badges get the existing `.badge-shimmer` class for the sweep animation.

---

## 4. Color Palette

### Team Colors

| Element          | Team Alpha (Blue)                                | Team Bravo (Red)                                 |
|------------------|--------------------------------------------------|--------------------------------------------------|
| Card border      | `border-blue-500/50`                             | `border-red-500/50`                              |
| Card header bg   | `bg-blue-500/10`                                 | `bg-red-500/10`                                  |
| Accent text      | `text-blue-400`                                  | `text-red-400`                                   |
| Win % bar fill   | `bg-blue-500`                                    | `bg-red-500`                                     |
| Team label       | `bg-blue-500/20 text-blue-300 border-blue-500/30`| `bg-red-500/20 text-red-300 border-red-500/30`   |

### Role Colors

| Role        | Color           | Tailwind                |
|-------------|-----------------|-------------------------|
| Duelist     | Orange-red      | `text-orange-400`       |
| Controller  | Green           | `text-emerald-400`      |
| Sentinel    | Cyan            | `text-cyan-400`         |
| Initiator   | Purple          | `text-purple-400`       |

### General Page Tokens (Dark Theme)

| Element            | Tailwind Classes                                              |
|--------------------|---------------------------------------------------------------|
| Page background    | `bg-background` (oklch 0.13)                                 |
| Card background    | `bg-card` (oklch 0.17) `rounded-xl border border-border`     |
| Input field        | `bg-input border border-border rounded-lg px-3 py-2`         |
| Primary button     | `bg-primary text-primary-foreground rounded-lg font-semibold` |
| Muted text         | `text-muted-foreground`                                       |
| Section heading    | `font-heading text-lg font-bold tracking-tight`               |
| Stat value (mono)  | `font-mono text-sm tabular-nums`                              |

---

## 5. Interactive Features

### 5.1 Drag-and-Drop Swap

Players can be dragged between teams for manual adjustments:

- Drag handle appears on hover (left side of player card, grip icon)
- While dragging, the card becomes semi-transparent with a blue/red tinted shadow
- Valid drop zones highlight with a dashed border
- On drop, the two players swap and all team stats recalculate instantly
- On mobile: tap a player to select, then tap a player on the other team to swap

### 5.2 Re-Balance Button

- Runs the balancing algorithm again with a different random seed
- Shows a brief shuffle animation on the player cards
- Displays how the new balance compares: "Win prediction improved: 51-49 (was 54-46)"

### 5.3 Randomize Button

- Assigns all 10 players to teams randomly (ignores stats)
- Fun/casual mode for groups who just want random picks
- Cards do a quick "dealing" animation as they fly to their teams

### 5.4 Copy to Discord

Generates formatted text and copies to clipboard:

```
**Team Alpha** (Predicted Win: 52%)
1. TenZ#0505 - Radiant (Duelist)
2. Player2#TAG - Diamond 2 (Controller)
3. Player3#TAG - Ascendant 1 (Sentinel)
4. Player4#TAG - Immortal 1 (Initiator)
5. Player5#TAG - Diamond 3 (Initiator)

**Team Bravo** (Predicted Win: 48%)
1. Aspas#BR1 - Immortal 3 (Duelist)
2. Player7#TAG - Diamond 1 (Duelist)
3. Player8#TAG - Ascendant 3 (Controller)
4. Player9#TAG - Diamond 2 (Sentinel)
5. Player10#TAG - Ascendant 2 (Initiator)
```

Toast notification: "Copied to clipboard!" with `sonner` toast.

---

## 6. Empty, Loading, and Error States

### Empty State (No Input Yet)

```
+--------------------------------------------------+
|                                                    |
|           [Crosshair icon / Valorant V]            |
|                                                    |
|         Enter 10 players to balance teams          |
|    Paste Riot IDs and we'll handle the rest        |
|                                                    |
|         [Paste 10 Names]  or fill below            |
|                                                    |
+--------------------------------------------------+
```

- Subtle background: angular geometric pattern at 5% opacity, Valorant-inspired
- The crosshair/V icon uses `text-red-500/60` with a slow pulse

### Loading Skeleton

While fetching player data, each player card slot shows:

```
+--------------------------------------------------+
|  [====]  [================]             [===]      |  <- skeleton bars
|  [========]  [======]  [========]                   |  <- pulse animation
+--------------------------------------------------+
```

Tailwind: `bg-muted animate-pulse rounded h-4 w-24`

### Error States

| Error                 | Display                                                                 |
|-----------------------|-------------------------------------------------------------------------|
| Player not found      | Red border on input, tooltip: "No player found with this Riot ID"       |
| Private profile       | Yellow border, tooltip: "This player's profile is set to private"       |
| API rate limited      | Banner at top: "API rate limit reached. Try again in X seconds."        |
| Fewer than 10 players | Button disabled, helper text: "Need X more players"                     |
| Network error         | Full-width alert: "Connection error. Check your internet and retry."    |

Error input styling: `border-red-500 bg-red-500/5 focus:ring-red-500/50`
Warning input styling: `border-yellow-500 bg-yellow-500/5 focus:ring-yellow-500/50`

---

## 7. Mobile-Specific Design

### Input Form (Mobile)

Single column, full-width inputs stacked vertically:

```
+----------------------------+
|  TEAM BALANCER             |
+----------------------------+
|  Region: [NA v]            |
|                            |
|  1. [Player#TAG        ] o |
|  2. [Player#TAG        ] o |
|  3. [Player#TAG        ] o |
|  4. [Player#TAG        ] o |
|  5. [Player#TAG        ] o |
|  6. [Player#TAG        ] o |
|  7. [Player#TAG        ] o |
|  8. [Player#TAG        ] o |
|  9. [Player#TAG        ] o |
| 10. [Player#TAG        ] o |
|                            |
|  [Paste Names]             |
|                            |
|  [     BALANCE TEAMS     ] |
+----------------------------+
```

Breakpoints:
- `< 640px` (sm): Single column, full-width cards
- `640px - 1024px` (md): Two columns for inputs, stacked team results
- `> 1024px` (lg): Full desktop layout with side-by-side teams

### Player Card (Mobile Compact)

```
+-------------------------------------------+
| [Rad] TenZ#0505        Duelist    WR 54%  |
|       ACS 289  K/D 1.34  ADR 168  HS 28% |
+-------------------------------------------+
```

Single row rank badge + name, second row stats. No agent icons to save space -- role dot color only.

---

## 8. Accessibility

| Requirement                       | Implementation                                                      |
|-----------------------------------|---------------------------------------------------------------------|
| Team identification               | Teams labeled "Alpha/Bravo" + color, not color alone                |
| Screen reader: player cards       | `aria-label="TenZ, Radiant rank, Duelist, Team Alpha"`              |
| Screen reader: win prediction     | `aria-label="Team Alpha predicted win rate 52 percent"`             |
| Keyboard: input navigation        | Tab flows through all 10 inputs, Enter moves to next empty          |
| Keyboard: team swap               | Focus player card, press Space to select, Tab to other team, Space to swap |
| Drag-and-drop fallback            | "Swap" button appears on card focus for keyboard-only users         |
| Color contrast                    | All text meets WCAG AA (4.5:1 ratio minimum)                       |
| Reduced motion                    | `prefers-reduced-motion: reduce` disables shuffle/deal animations   |
| Form labels                       | Each input has `aria-label="Player slot N"` + visible number label  |

---

## 9. Component Hierarchy

```
TeamBalancerPage
  |-- InputPhase
  |     |-- PageHeader (title + subtitle)
  |     |-- PlayerInputGrid
  |     |     |-- PlayerInputField x 10
  |     |     |     |-- TextInput
  |     |     |     |-- StatusIcon
  |     |     |     |-- MiniPlayerPreview (rank + RR, shown when validated)
  |     |-- RegionSelector
  |     |-- QuickFillButton -> QuickFillModal
  |     |-- BalanceButton
  |     |-- LoadingProgress
  |
  |-- ResultsPhase
        |-- BackToEditButton
        |-- TeamCardsRow (flex row desktop, tabs mobile)
        |     |-- TeamCard (Alpha / Blue)
        |     |     |-- TeamHeader (name, predicted win, avg stats)
        |     |     |-- PlayerStatCard x 5
        |     |           |-- RankBadge
        |     |           |-- StatGrid
        |     |           |-- AgentPool
        |     |           |-- RoleIndicator
        |     |           |-- ExpandedDetails (collapsible)
        |     |-- TeamCard (Bravo / Red)
        |           |-- (same structure)
        |-- TeamComparison
        |     |-- SplitBar (win %)
        |     |-- StatComparisonRows
        |     |-- RoleCompositionChart
        |-- ActionBar
              |-- ReBalanceButton
              |-- RandomizeButton
              |-- CopyToDiscordButton
```

---

## 10. Animation Specifications

| Animation            | Trigger                    | Duration | Easing              | CSS/Framer Motion                   |
|----------------------|----------------------------|----------|----------------------|--------------------------------------|
| Input validation     | On blur / player found     | 200ms    | ease-out             | Scale badge in from 0 to 1           |
| Balance transition   | Submit -> results          | 400ms    | ease-in-out          | Input phase slides up, results fade in |
| Card deal            | Results appear             | 300ms ea | spring (stagger 80ms)| Cards slide in from center, fan out  |
| Shuffle (re-balance) | Re-balance click           | 600ms    | ease-in-out          | Cards briefly stack center, re-deal  |
| Drag ghost           | Drag start                 | -        | -                    | `opacity-50 scale-105 shadow-xl`     |
| Swap complete        | Drop on valid target       | 250ms    | spring               | Cards cross-fade positions           |
| Skeleton pulse       | Loading                    | 1.5s     | ease-in-out          | `animate-pulse` (Tailwind built-in)  |
| Win bar fill         | Results appear             | 800ms    | ease-out             | Width animates from 0% to final      |

---

## 11. Data API Shape (Frontend Expectations)

### Request

```typescript
POST /api/valorant/balance-teams
{
  players: string[]       // 10 Riot IDs (e.g., "TenZ#0505")
  region: "na" | "eu" | "ap" | "kr"
}
```

### Response

```typescript
{
  teamAlpha: {
    players: PlayerData[]
    predictedWinRate: number     // 0-100
    avgACS: number
    avgKD: number
    avgADR: number
    avgHS: number
  }
  teamBravo: {
    players: PlayerData[]
    predictedWinRate: number
    avgACS: number
    avgKD: number
    avgADR: number
    avgHS: number
  }
  balanceScore: number          // 0-100, how close the teams are
}

interface PlayerData {
  riotId: string
  rank: string                  // "Radiant", "Immortal 3", etc.
  rr: number
  acs: number
  kd: number
  adr: number
  hsPercent: number
  winRate: number
  topAgents: {
    name: string
    games: number
    winRate: number
  }[]
  primaryRole: "Duelist" | "Controller" | "Sentinel" | "Initiator"
  recentForm: {
    winRate: number
    avgACS: number
    trend: "up" | "down" | "stable"
  }
}
```

---

## 12. Key Tailwind Class Reference

### Full-Width Primary Action Button
```
bg-primary text-primary-foreground
font-heading font-bold text-lg
w-full py-4 rounded-xl
hover:brightness-110 active:scale-[0.98]
transition-all duration-150
disabled:opacity-40 disabled:cursor-not-allowed
```

### Team Card Container
```
bg-card rounded-xl border-2
p-4 md:p-6
flex flex-col gap-3
// Alpha: border-blue-500/40
// Bravo: border-red-500/40
```

### Player Stat Card
```
bg-background/50 rounded-lg border border-border
p-3 hover:border-primary/30
transition-colors duration-150
cursor-pointer  // for expand/collapse
```

### Comparison Split Bar
```
h-3 rounded-full overflow-hidden flex
bg-muted
// Left fill: bg-blue-500 transition-all duration-800
// Right fill: bg-red-500 transition-all duration-800
```

### Region Dropdown
```
bg-input border border-border rounded-lg
px-3 py-2 text-sm
focus:ring-2 focus:ring-ring
```
