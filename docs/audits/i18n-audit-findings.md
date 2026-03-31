# i18n Audit Findings

## Hardcoded Strings to Fix

### Home.tsx
1. Line 613: `title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}` — tooltip title
2. Line 630: `title="Toggle language"` — tooltip title
3. Line 790: `title="Edit display name"` — tooltip title
4. Line 346: `>Rank<` in PostGameBanner — hardcoded "Rank" label
5. Line 214: `>LIVE<` in LiveGameBanner — hardcoded "LIVE" text (should use t.common.live)
6. Line 373: `"Perfect"` — KDA value when deaths=0
7. Line 394: `"Ranked Solo"` — queue type for matches
8. Line 733: `S2026` — season indicator (brand/technical, acceptable)

### TradingPanel.tsx
9. Line 265: `toast.error("Please wait before placing another trade")` — cooldown toast
10. Line 430: `"Trading halted — player is in a live game. Trades resume after the match ends."` — halt message
11. Line 552/684: `placeholder="Number of shares"` — input placeholder
12. Line 597: `Sell All {shares} shares (≈${value})` — sell all button text
13. Line 733: `Cover All {shares} shares (≈${value})` — cover all button text
14. Line 363: `"HALTED"` — market status label

### MatchRow.tsx
15. Line 91: `>CS<` — creep score label (gaming term, but should be translated)

### Login.tsx
16. Uses `|| "fallback"` pattern — these are defensive fallbacks, not bugs. The t.auth keys exist.

### AdminDB.tsx / AdminSQL.tsx
17. All English — intentionally English-only admin pages. Acceptable.

## Summary
- 15 hardcoded strings need i18n keys
- Admin pages (AdminDB, AdminSQL) are intentionally English-only
- Login/Register pages use fallback patterns but keys exist — low priority cleanup
