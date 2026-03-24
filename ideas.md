# Design Brainstorm: LoL LP Tracker (Robinhood/TradingView Style)

<response>
<text>

## Idea 1: "Terminal Trader" — Bloomberg Terminal Meets Gaming

**Design Movement**: Bloomberg Terminal / Hacker aesthetic with financial data density
**Core Principles**:
1. Information density over whitespace — every pixel earns its place
2. Monospaced typography creates a "data terminal" feel
3. Neon green on near-black backgrounds for that classic terminal look
4. Real-time data presentation with blinking cursors and live indicators

**Color Philosophy**: Pure black (#0A0A0A) background with phosphor green (#00FF41) as primary accent. Red (#FF3B30) for losses, green for wins. Amber (#FFB800) for warnings/neutral states. The palette evokes CRT monitors and trading floors.

**Layout Paradigm**: Dense multi-panel layout like Bloomberg Terminal. Header ticker bar, main chart area taking 60% of viewport, side panels for stats. No wasted space — data tables, mini charts, and stat blocks fill every corner.

**Signature Elements**:
1. Scrolling ticker bar at the top showing LP changes like stock prices
2. ASCII-art inspired rank badges and dividers
3. Scanline overlay effect on the main chart area

**Interaction Philosophy**: Keyboard-first navigation hints. Hover reveals dense tooltips with match data. Click-through feels like drilling into financial reports.

**Animation**: Typewriter text reveals for stats. Number counters that "tick" up/down like stock tickers. Subtle CRT flicker on focus. Chart line draws in real-time on load.

**Typography System**: JetBrains Mono for all data/numbers. Space Grotesk for headings. Strict monospace grid alignment for data tables.

</text>
<probability>0.06</probability>
</response>

<response>
<text>

## Idea 2: "Clean Broker" — Robinhood's Minimalist Finance UI

**Design Movement**: Neo-minimalist fintech, directly inspired by Robinhood's clean, confident design language
**Core Principles**:
1. Generous whitespace creates breathing room around data
2. One hero element per section — the LP chart dominates
3. Color is functional, not decorative — green/red only for win/loss
4. Typography hierarchy guides the eye naturally

**Color Philosophy**: Deep charcoal (#1B1B1B) as primary background, slightly lighter cards (#242424). Robinhood's signature green (#00C805) for positive/wins. Warm red (#FF5252) for losses. White (#FFFFFF) for primary text, muted gray (#9E9E9E) for secondary. The palette is deliberately restrained — color only appears when it means something.

**Layout Paradigm**: Single-column scrolling layout with a sticky header. The LP chart is the hero — massive, interactive, taking up the full viewport width. Below it, horizontally scrollable cards for champion stats, then a clean match history list. Inspired by Robinhood's stock detail page.

**Signature Elements**:
1. Large, bold LP number at the top with percentage change badge (like stock price display)
2. Smooth area chart with gradient fill that shifts green/red based on trend
3. Time range selector pills (1D, 1W, 1M, Season) below the chart

**Interaction Philosophy**: Touch-friendly, mobile-first. Drag across chart to see LP at any point. Tap champion cards to expand stats. Everything feels like a premium mobile app.

**Animation**: Smooth spring animations on number changes. Chart area fills with a gentle wave animation on load. Cards slide up with staggered delays. Hover states use scale transforms with ease-out curves.

**Typography System**: DM Sans for headings (bold, confident). Plus Jakarta Sans for body text. Tabular numbers for all data displays to maintain alignment.

</text>
<probability>0.08</probability>
</response>

<response>
<text>

## Idea 3: "Dark Exchange" — TradingView's Professional Charting UI

**Design Movement**: Professional trading platform aesthetic — TradingView meets crypto exchange dashboards
**Core Principles**:
1. The chart is king — everything else supports it
2. Subtle borders and elevation create panel hierarchy without heavy shadows
3. Micro-interactions signal data freshness and interactivity
4. Dark mode is the only mode — traders work in the dark

**Color Philosophy**: Three-tier dark system — deepest black (#0C0D0F) for background, medium (#1A1D23) for panels, lighter (#262A33) for elevated cards. Emerald green (#26A69A) for wins/positive (TradingView's signature). Coral red (#EF5350) for losses. Electric blue (#2196F3) for interactive elements and links. Gold (#FFD54F) for rank highlights.

**Layout Paradigm**: Dashboard grid with resizable panels. Top bar shows player identity + key stats. Left 70% is the massive interactive LP chart with crosshair cursor. Right 30% is a stacked panel: rank info, champion breakdown, streak indicator. Below the fold: full match history table with sortable columns.

**Signature Elements**:
1. Crosshair cursor on chart that shows exact LP/date on hover with floating tooltip
2. "Candlestick-style" win/loss bars in the match history showing KDA range
3. Glowing rank badge with animated particle border matching tier color

**Interaction Philosophy**: Precision-focused. Chart supports zoom, pan, and crosshair. Data tables have sortable headers. Everything has a tooltip. The UI rewards exploration.

**Animation**: Chart draws with a smooth left-to-right reveal. Numbers use counting animations. Panel borders pulse subtly on data update. Streak indicators use a heartbeat-like pulse. Smooth 200ms transitions on all hover states.

**Typography System**: Inter for UI chrome and labels. Roboto Mono for all numerical data (LP, KDA, CS). Font sizes follow a strict 12/14/16/20/28/36 scale. Heavy use of font-weight contrast (400 vs 700) rather than size changes.

</text>
<probability>0.07</probability>
</response>
