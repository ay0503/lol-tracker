# $DORI Casino Cosmetics: Pricing Psychology & Shop UX

**Status**: Design Document
**Owner**: PM Council #3 (Pricing Psychology, Shop UX, Progression)
**Date**: 2026-03-26

---

## Executive Summary

Casino cosmetics give players a **reason to grind** and convert house-edge losses into **visible status**. This document defines the pricing architecture, shop psychology, and progression systems that drive engagement and retention.

**Core Insight**: Players don't care about losing $20 over a week if they walk away with a legendary "🔥 High Roller" title. Cosmetics transform gambling into collectible progression.

---

## 1. Earning Curve Analysis

### Current Economics
- **Starting balance**: $20.00
- **Daily bonus**: $1.00/day
- **House edge**: 2-5% (varies by game)
- **Deposit cap**: $1-$50 from trading balance

### Earning Scenarios

| Playstyle | Daily Earnings | Weekly Total | Notes |
|-----------|---------------|--------------|-------|
| **Conservative** (bonus only) | +$1.00 | $7.00/week | Never gambles, just claims |
| **Casual grinder** (small bets, bonus) | +$0.50 avg | $3.50/week | Plays for fun, loses slowly |
| **Lucky streak** (hot run) | +$5-20 | $35-140/week | Wins big on crash/blackjack |
| **Degen mode** (all-in swings) | -$10 to +$50 | Volatile | High variance |

### Key Milestones
- **$30**: 10 days of bonuses + minimal play
- **$50**: ~3-4 weeks of consistent grinding
- **$100**: Lucky streak or 3 months of slow accumulation
- **$500**: Legendary territory, requires serious wins or months of daily bonuses

---

## 2. Price Architecture

### Tier System (Psychology: Anchoring + Aspiration)

#### **Common** — Instant Gratification ($5-$15)
*"I can afford this after 1 week of daily bonuses"*

- **$5**: Basic titles, simple effects
- **$10**: Starter bundles, single-color themes
- **$15**: Entry-level "flex" items

**Example Items**:
- 🎲 "Lucky Streak" title — $5
- 💰 "Coin Flipper" title — $5
- ✨ Gold sparkle name effect — $8
- 🌟 Silver shimmer name effect — $8
- 🎰 "Casino Enjoyer" title — $10
- Neon Green name color — $12

---

#### **Rare** — Weekend Goal ($20-$40)
*"If I grind this weekend and get lucky, I can buy this"*

- **$20-25**: Premium titles, dual effects
- **$30-35**: Collection starters (3/5 set)
- **$40**: High-quality effects

**Example Items**:
- 🔥 "On Fire" title — $20
- 🚀 "To The Moon" title — $22
- 💎 Diamond sparkle effect — $25
- 🌈 Rainbow name gradient — $30
- ⚡ Lightning strike animation — $35
- 👑 "High Roller" title — $40

---

#### **Epic** — Flex Territory ($50-$100)
*"I've been grinding for weeks OR I hit a massive crash multiplier"*

- **$50**: Rare animated effects
- **$75**: Limited edition items (rotate monthly)
- **$100**: Prestige titles

**Example Items**:
- 👑 "Whale" title — $50
- 🎆 Firework explosion effect — $60
- 🔮 Mystic glow aura — $70
- 💀 "House Always Wins" title (ironic) — $75
- ⚡ "Lightning God" animated title — $80
- 🌌 Galaxy swirl effect — $90
- 🏆 "Casino King" title — $100

---

#### **Legendary** — Grail Items ($150-$500)
*"This is my endgame. I'm grinding for MONTHS."*

- **$150-200**: Ultra-rare effects, exclusive titles
- **$300-400**: Collection completionist items
- **$500**: Ultimate status symbols

**Example Items**:
- 💸 "Money Printer" animated title — $150
- 🌟 "Touched by RNG" halo effect — $180
- 👹 "Degen Overlord" title — $200
- 🎰 "Casino Tycoon" full set (title + effect + border) — $250
- 🔥 Eternal flame trail effect — $300
- 🏆 "Infinite Luck" legendary title — $400
- 💎 "Diamond Hands" ultra-rare bundle — $500

---

### Rental System (Optional Monetization Layer)

**Concept**: Let players "test drive" expensive items or rent temporary status.

| Rental Duration | Price Multiplier | Use Case |
|-----------------|------------------|----------|
| 24 hours | 5% of full price | Quick flex for screenshots |
| 7 days | 15% of full price | Trial before buying |
| 30 days | 40% of full price | Monthly subscription feel |

**Example**:
- 🏆 "Casino King" title ($100)
  - Rent for 24h: $5
  - Rent for 7d: $15
  - Rent for 30d: $40
  - Own forever: $100

**Psychological Hook**: After renting for 30 days ($40), player is emotionally invested. "I've already paid $40... might as well pay $60 more to own it forever."

---

## 3. Shop Psychology Triggers

### A. Anchoring Effect
**Show most expensive items FIRST** so cheaper ones feel like deals.

```
Shop layout:

[LEGENDARY]
🏆 Casino Tycoon Bundle — $250 ← ANCHOR
💎 Diamond Hands Set — $500

[EPIC]
⚡ Lightning God — $80 ← "Only $80? That's nothing!"
🔮 Mystic Glow — $70

[RARE]
🔥 On Fire — $20 ← "Wow, basically free"
```

### B. Scarcity & FOMO
- **Limited Edition** badges on 3 rotating items per week
- **"Only 5 players own this"** counter (real-time)
- **"Sale ends in 2d 14h"** countdown (weekly rotation)
- **Seasonal exclusives** (e.g., "🎃 Spooky Gambler" October only)

### C. Social Proof
- **"Most Popular This Week"** badge
- **"47 players own this"** display
- **Leaderboard integration**: Show cosmetics on top players' names

### D. Loss Aversion
- **"🔥 Flash Sale — 30% OFF — 6h remaining"** panic timer
- **"Last chance to buy before rotation!"** messaging
- **"You're 1 item away from completing the Neon Collection"** progress bars

### E. Endowment Effect (Preview System)
**Before purchasing**, show player's name WITH the cosmetic applied:

```
┌────────────────────────────────────┐
│ PREVIEW                            │
│                                    │
│ 🔥 High Roller ayoun ✨            │ ← Live preview
│                                    │
│ This is how you'll appear on the   │
│ leaderboard and in game lobbies.   │
│                                    │
│ [Buy for $40] [Cancel]             │
└────────────────────────────────────┘
```

**Psychological impact**: Once player sees their name with the cosmetic, it feels like it's already theirs. Canceling = **losing** something they "own."

---

## 4. Shop Layout & UX

### Tab Structure

```
┌─────────────────────────────────────────────────┐
│ $DORI CASINO SHOP               Balance: $87.50 │
├─────────────────────────────────────────────────┤
│ [Featured] [Titles] [Effects] [Bundles] [My Items] │
└─────────────────────────────────────────────────┘
```

#### Tab 1: Featured (Landing Page)
- **Daily Featured Deal** (1 item at 30% off)
- **Limited Time Offers** (3 items with countdown)
- **New Arrivals** (last 7 days)
- **Staff Picks** (curated by "casino management")

#### Tab 2: Titles
- Sort by: Price (Low→High, High→Low), Popularity, New
- Filter: Owned/Unowned, Affordable (≤ my balance)
- **Grid view** with hover previews

#### Tab 3: Name Effects
- Color gradients, animations, particles
- Live preview on hover

#### Tab 4: Bundles
- **Value proposition**: "Save 25% buying the set"
- **Collection progress**: "You own 2/5 Neon items — Complete the set!"

#### Tab 5: My Items
- **Equipped cosmetics** (current loadout)
- **Owned collection** (all purchased items)
- **Rental history** (if implemented)

---

### Item Card Design (Psychological Optimization)

```
┌──────────────────────────┐
│ 🔥 ← Large emoji          │
│ "High Roller"             │
│                           │
│ [$40]  ← Price prominent  │
│                           │
│ 🏅 Most Popular           │ ← Social proof badge
│ 👤 127 players own this   │ ← Scarcity counter
│                           │
│ ⏰ Sale ends in 2d 14h    │ ← FOMO timer (if on sale)
│                           │
│ [Preview] [Buy Now]       │
└──────────────────────────┘
```

---

### Sorting & Filtering (Reduce Choice Paralysis)

**Default sort**: "Featured" (algorithm-driven)
- Recently added
- Items near player's balance
- Completion of collections player started

**Sort options**:
- Price: Low → High (help broke players find deals)
- Price: High → Low (status flex browsing)
- Popularity (social proof)
- New arrivals (FOMO)

**Filters**:
- ✅ **"I Can Afford"** (≤ current balance) — reduce frustration
- ✅ **"Unowned"** (hide purchased)
- ✅ **"On Sale"** (show discounts)
- ✅ **"Limited Edition"** (FOMO filter)

---

## 5. Equip System

### Loadout Structure

**Slot-based system** (prevents visual clutter):

```
┌─────────────────────────────────────┐
│ YOUR LOADOUT                        │
├─────────────────────────────────────┤
│ [Title Slot]     🔥 High Roller     │ ← 1 title
│ [Name Effect]    ✨ Gold Sparkle    │ ← 1 effect
│ [Border]         💎 Diamond Frame   │ ← 1 border (future)
└─────────────────────────────────────┘

Result: 💎🔥 High Roller ayoun ✨
```

**Max stack**: Title + Effect + Border (3 slots)

**Why limit?**
- Prevents visual spam
- Forces meaningful choices ("Which cosmetic represents me best?")
- Creates **desire for multiple loadouts** (future feature: save 3 presets)

### Instant Equip
- Click cosmetic → **immediately equipped**
- No "Save" button friction
- Real-time preview on leaderboard/game lobbies

---

## 6. Incentive Loops (Engagement Hooks)

### Daily Featured Deal
- **1 random item at 30% off**, rotates at midnight UTC
- **Notification**: "Today's deal: 🔥 On Fire title — $14 (was $20)"
- **Psychological hook**: "I wasn't going to buy anything today, but this is a DEAL..."

### Bundles (Collection Completion OCD)
```
🌈 NEON COLLECTION (5 items)
✅ Neon Green name — $12 (owned)
✅ Neon Pink title — $15 (owned)
❌ Neon Blue effect — $18
❌ Neon Purple border — $20
❌ Neon Rainbow bundle — $25

Progress: 2/5 (40%)
Buy remaining 3 items: $63 → Bundle price: $47 (Save $16!)
```

**Psychological trap**: Sunk cost fallacy. "I already own 2... I HAVE to complete it."

### Achievement-Unlocked Cosmetics (Free Grind)

**Concept**: Some cosmetics are **earned**, not bought.

| Achievement | Requirement | Unlock |
|-------------|-------------|--------|
| 🃏 "Card Counter" | Win 10 blackjack hands | Title (free) |
| 🚀 "Moon Mission" | Cash out at 10x+ in Crash | Title (free) |
| 🎰 "Slot Savant" | Play 100 total casino games | Title (free) |
| 💀 "Risk Taker" | Lose $50 in one session | Ironic title (free) |
| 🏆 "Casino Legend" | Reach $500 balance | Legendary title (free) |

**Psychological impact**:
- **Free cosmetics** feel earned, not bought → pride
- **Drives gameplay**: "I need 3 more blackjack wins for the title!"
- **Status hierarchy**: Bought cosmetics = whale, earned cosmetics = skill

---

### Seasonal/Event Cosmetics

**Concept**: Limited-time items create urgency.

| Event | Duration | Example Items |
|-------|----------|--------------|
| 🎃 **Spooktober** | October | "Spooky Gambler" title, Ghost trail effect |
| 🎄 **Winter Bash** | December | "Santa's Whale" title, Snowflake effect |
| 🎆 **New Year** | January | "Fresh Start" title, Firework animation |
| 💘 **Valentine's** | February | "Love the Grind" title, Heart particles |
| 🍀 **Lucky March** | March | "Pot of Gold" title, Rainbow effect |

**After event ends**: Items become **legacy cosmetics**
- Can't be purchased again
- Massive FOMO for next year
- Creates **collector economy** ("I wish I played during Spooktober 2026...")

---

## 7. Shop Navigation & Discoverability

### Search Bar (Future)
- "Search cosmetics..." autocomplete
- Example: "fire" → shows 🔥 On Fire title, Eternal Flame effect, etc.

### Collections View
```
┌─────────────────────────────────────────┐
│ COLLECTIONS                             │
├─────────────────────────────────────────┤
│ 🌈 Neon Collection        [2/5] 40%     │
│ 💎 Diamond Series         [0/3] 0%      │
│ 🔥 Fire & Fury Bundle     [1/4] 25%     │
│ 🎃 Spooktober (Limited)   [0/6] EXPIRED │
└─────────────────────────────────────────┘
```

**Click collection** → Shows all items, completion discount

### "Recommended For You" (Algorithm)

**Personalization factors**:
1. **Balance-appropriate** (show items ≤ 1.5x balance)
2. **Collection completion** (missing 1 item from set = high priority)
3. **Playstyle** (plays Crash often → show rocket-themed cosmetics)
4. **Social proof** (items friends own)

---

## 8. Monetization Psychology Summary

### Why This Works

| Principle | Implementation | Expected Impact |
|-----------|----------------|-----------------|
| **Anchoring** | Show $500 items first | Makes $40 feel cheap |
| **Scarcity** | Limited edition, timers | Panic buying |
| **Social proof** | "127 own this" counters | FOMO |
| **Loss aversion** | Sale timers, rental expiry | Urgency |
| **Endowment effect** | Live preview before buy | Feels like losing if canceled |
| **Sunk cost** | Collection progress bars | "I already own 2/5..." |
| **Achievement unlock** | Free grind cosmetics | Drives gameplay hours |
| **Status signaling** | Leaderboard cosmetics | Flexing > winning |

---

## 9. Revenue Potential (If Real Money)

**Hypothetical scenario**: If cosmetics were sold for real money (NOT planned, purely theoretical)

| Player Type | % of Users | Avg Spend/Month | Notes |
|-------------|------------|-----------------|-------|
| **Free (bonus only)** | 70% | $0 | Never buys, grinds for free cosmetics |
| **Minnow** | 20% | $5-10 | Buys 1-2 common items |
| **Dolphin** | 8% | $20-50 | Completes collections |
| **Whale** | 2% | $100-500 | Owns legendaries, flexes hard |

**But**: This is a **virtual casino** — cosmetics are bought with casino cash, which is EARNED, not purchased.

---

## 10. Technical Implementation Checklist

### Phase 1: MVP (Week 1-2)
- [ ] Schema: `cosmetics` table (id, name, type, price, rarity, emoji, description)
- [ ] Schema: `user_cosmetics` table (userId, cosmeticId, purchasedAt, expiresAt)
- [ ] Schema: `user_loadout` table (userId, titleId, effectId, borderId)
- [ ] API: `GET /cosmetics` (list all)
- [ ] API: `POST /cosmetics/purchase` (buy item)
- [ ] API: `POST /cosmetics/equip` (change loadout)
- [ ] UI: Shop page (grid view, filters)
- [ ] UI: Leaderboard integration (show equipped cosmetics)

### Phase 2: Psychology Features (Week 3-4)
- [ ] Daily featured deal (30% off rotation)
- [ ] Limited edition tagging + timers
- [ ] Social proof counters ("X players own this")
- [ ] Preview modal (live name rendering)
- [ ] Collection progress bars
- [ ] Bundle pricing discounts

### Phase 3: Engagement Loops (Week 5-6)
- [ ] Achievement system (free unlocks)
- [ ] Seasonal cosmetics (event calendar)
- [ ] Rental system (optional)
- [ ] "Recommended for you" algorithm
- [ ] Multiple loadout presets

---

## 11. Success Metrics

### Key Performance Indicators (KPIs)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Shop visit rate** | 60% of active users/day | Analytics |
| **Purchase conversion** | 30% buy ≥1 item/week | Transaction logs |
| **Collection completion** | 15% complete ≥1 set | Database queries |
| **Equipped rate** | 80% have ≥1 cosmetic equipped | Loadout table |
| **Daily bonus claim rate** | 70% claim bonus/day | Engagement hook |
| **Leaderboard engagement** | +40% views after cosmetics launch | Analytics |

### A/B Test Ideas
1. **Anchor pricing**: Does showing $500 items first increase sales of $40 items?
2. **Scarcity timers**: Do "Sale ends in 6h" timers boost purchases vs. no timer?
3. **Preview CTA**: "Try it on" button vs. "Buy now" — which converts better?
4. **Bundle discounts**: 20% off vs. 30% off — where's the sweet spot?

---

## 12. Content Roadmap (First 30 Days)

### Launch (Week 1)
**20 items total**
- 10 Common titles ($5-15)
- 5 Rare effects ($20-40)
- 3 Epic items ($50-80)
- 2 Legendary bundles ($100-200)

### Week 2: Social Proof
- Add "Most Popular" badges
- Display ownership counters
- Launch first daily featured deal

### Week 3: Collections
- Introduce "🌈 Neon Collection" (5 items)
- Add bundle discount (save 25%)
- Progress bars

### Week 4: Events
- First limited edition drop (7-day timer)
- Achievement unlocks go live
- Seasonal cosmetic (if near holiday)

---

## 13. Example Item Catalog (Launch Set)

### COMMON TITLES ($5-15)
1. 🎲 "Lucky Streak" — $5
2. 💰 "Coin Flipper" — $5
3. 🃏 "Card Shark" — $8
4. 🎰 "Casino Enjoyer" — $10
5. 🍀 "Four Leaf Clover" — $10
6. 🎯 "Sharp Shooter" — $12
7. 💸 "Money Maker" — $12
8. 🎪 "Circus Act" — $15
9. 🎭 "Risk Lover" — $15
10. 🌙 "Night Owl Grinder" — $15

### COMMON EFFECTS ($8-15)
1. ✨ Gold Sparkle — $8
2. 🌟 Silver Shimmer — $8
3. 💚 Neon Green name — $12
4. 💖 Neon Pink name — $12
5. 💙 Neon Blue name — $12

### RARE TITLES ($20-40)
1. 🔥 "On Fire" — $20
2. 🚀 "To The Moon" — $22
3. ⚡ "Lightning Fast" — $25
4. 🏴‍☠️ "Pirate of Fortune" — $30
5. 👑 "High Roller" — $40

### RARE EFFECTS ($25-35)
1. 💎 Diamond Sparkle — $25
2. 🌈 Rainbow Gradient — $30
3. ⚡ Lightning Strike — $35

### EPIC ITEMS ($50-100)
1. 👑 "Whale" title — $50
2. 🎆 Firework Explosion — $60
3. 💀 "House Always Wins" — $75
4. 🏆 "Casino King" title — $100

### LEGENDARY BUNDLES ($150-250)
1. 💸 "Money Printer" bundle (title + effect) — $150
2. 🎰 "Casino Tycoon" full set (title + effect + border) — $250

---

## 14. Final Recommendations

### Priority 1: Launch MVP Fast
- **Don't overthink**: Ship 20 items, basic shop UI, purchase flow
- **Iterate**: Launch → measure → optimize

### Priority 2: Psychology Over Aesthetics
- **Scarcity timers > fancy animations**
- **Social proof > perfect design**
- **Preview system > high-res icons**

### Priority 3: Engagement > Revenue
- **Daily bonus keeps players coming back**
- **Free achievement cosmetics drive gameplay**
- **Leaderboard cosmetics create status economy**

### Priority 4: Test Pricing Elasticity
- **A/B test**: $40 vs $50 for "High Roller" title — which sells more?
- **Monitor**: If no one buys legendaries, drop to $300 from $500
- **Adjust**: If everyone buys out commons, raise prices 20%

---

## Appendix: Naming Conventions

### Title Naming Patterns
- **Achievement-based**: "Card Counter", "Moon Mission"
- **Status flex**: "High Roller", "Whale", "Casino King"
- **Ironic**: "House Always Wins", "Professional Loser"
- **Themed**: "Pirate of Fortune", "Lightning God"

### Effect Naming Patterns
- **Material**: Diamond, Gold, Silver, Neon
- **Nature**: Lightning, Fire, Galaxy, Rainbow
- **Action**: Sparkle, Shimmer, Glow, Trail

---

**END OF DESIGN DOCUMENT**

---

### Next Steps
1. **PM #1 (Core Loop)**: Review pricing vs. daily bonus economy — are legendaries too expensive?
2. **PM #2 (Social/Leaderboard)**: Design leaderboard cosmetic rendering (how do we display 💎🔥 High Roller ayoun ✨?)
3. **Engineering**: Schema + API implementation timeline
4. **Design**: Mock up shop UI, item cards, preview modal

**Questions? Ping #casino-cosmetics channel**
