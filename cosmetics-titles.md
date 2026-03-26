# Casino Cosmetics: Titles & Tags

## Overview
Titles appear next to player names on the leaderboard. They're purchased with casinoBalance and create status signaling + reason to grind casino games.

**Psychology levers:**
- **Identity signaling** — "I'm a high roller" / "I'm built different"
- **FOMO** — Limited stock creates urgency
- **Social proof** — Rare titles = respect
- **Loss aversion** — "I'm up, might as well flex"

---

## COMMON TIER ($5-15)
*Entry-level flex. Anyone can afford these, low commitment.*

### 1. **Lucky Charm** — $5
First title most people buy. "I just won big and feel lucky."

### 2. **Card Counter** — $8
Blackjack grinder identity. Appeals to players who think they have "strategy."

### 3. **Down Bad** — $10
Self-deprecating meme. Buys after a loss streak to cope.

### 4. **Copium Dealer** — $12
Meme title. For the player who constantly says "I'm due for a win."

### 5. **Paper Hands** — $10
Trading crossover. Ironically embracing weak mentality.

### 6. **Casual Gambler** — $5
Low-stakes player. Safe, boring, first purchase.

### 7. **Slot Enjoyer** — $8
For players who just vibe with RNG games (Crash/Mines).

### 8. **Betting Enthusiast** — $7
Generic but respectable starter title.

---

## RARE TIER ($25-50)
*Shows commitment. You've been grinding or hit a big win.*

### 9. **High Roller** — $35
Classic casino flex. Shows you have money to burn.

### 10. **Card Shark** — $40
Blackjack specialist identity. "I know what I'm doing."

### 11. **Diamond Hands** — $45
Trading crossover. "I hold through the dips."

### 12. **Elo Gambler** — $30
LoL crossover. "I bet on games AND rank."

### 13. **Ranked Degen** — $38
Self-aware LoL grinder who also grinds casino.

### 14. **Risk Taker** — $32
Flex for Mines/Crash players who go for high multipliers.

### 15. **House Always Wins** — $50
Ironic flex. "I lost a lot but I'm still here."

### 16. **Profit Prophet** — $42
For the player who claims they're "always up."

### 17. **Whale Watcher** — $35
Aspiring whale. Not there yet but grinding.

### 18. **Crash Test Dummy** — $28
Self-deprecating Crash player. "I always cash out too late."

---

## EPIC TIER ($75-150)
*Serious flex territory. You're either a whale or grinded hard.*

### 19. **Built Different** — $100
Ultimate flex. "I don't follow the rules."

### 20. **Main Character** — $120
Peak narcissism. Center of attention energy.

### 21. **Casino Royale** — $90
Classy, prestigious. For the sophisticated degen.

### 22. **Jackpot Hunter** — $85
Aspirational. "I'm here for the big wins."

### 23. **Blackjack Legend** — $110
Blackjack specialist flex. Implies mastery.

### 24. **Money Printer** — $95
"I just win." Cocky energy.

### 25. **Challenger Gambler** — $130
LoL crossover. Top 0.1% energy applied to casino.

### 26. **All In Andy** — $105
High-risk player identity. No fear.

### 27. **Degen Royalty** — $140
Self-aware whale. Embracing the chaos.

---

## LEGENDARY TIER ($250-500)
*Ultra rare. Whale-only territory. Conversation starters.*

### 28. **Casino Overlord** — $300
Top of the food chain. Dominance flex.

### 29. **Unhinged** — $400
**LIMITED STOCK: Only 10 available**
Peak degen energy. FOMO driver. "I'm too far gone."

### 30. **Money Bags** — $350
Flex wealth. Simple, direct, powerful.

### 31. **House Edge Survivor** — $275
Ironic flex. "I beat the odds (or didn't and still flexing)."

### 32. **Limit Does Not Exist** — $500
**LIMITED STOCK: Only 5 available**
Ultimate whale title. Reference to "sky's the limit."

---

## FOMO & Aspirational Design

### Limited Stock Titles (Create Urgency)
- **Unhinged** — Only 10 available
- **Limit Does Not Exist** — Only 5 available

### Aspirational Titles (Make People Grind)
- **Casino Overlord** — Top-tier status
- **Built Different** — Identity-defining
- **Main Character** — Social proof flex

### Conversation Starters
- **Down Bad** — Relatable, funny
- **Unhinged** — "Bro are you okay?"
- **Limit Does Not Exist** — "How much did you spend???"

### Identity Signaling
- **Card Shark / Blackjack Legend** — Skill identity
- **Diamond Hands / Paper Hands** — Trading personality
- **Elo Gambler / Ranked Degen** — LoL crossover

---

## Implementation Notes

### Database Schema
```typescript
interface Title {
  id: string;
  name: string;
  tier: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  price: number;
  description: string;
  limitedStock?: number; // null = unlimited
  remainingStock?: number; // for limited titles
}
```

### Purchase Flow
1. User selects title from shop
2. Check balance >= price
3. If limited stock, check availability
4. Deduct casinoBalance
5. Add title to user's inventory
6. Allow user to equip ONE title at a time

### Leaderboard Display
```
1. ayoun [Casino Overlord] — $42,069
2. player2 [Down Bad] — $12
3. player3 [Card Shark] — $350
```

### Future Expansion Ideas
- **Seasonal titles** — "Summer Whale", "Holiday Degen"
- **Achievement titles** — "First Blood" (first $1000 win)
- **Dynamic titles** — "Currently Up" (changes based on profit/loss)
- **Title bundles** — "Starter Pack" (3 commons for $20)
- **Title gifting** — Send titles to friends

---

## Pricing Psychology

### Why These Prices Work

**Common ($5-15):**
- Impulse buy territory
- "I just won $50, might as well grab a title"
- Low barrier to entry

**Rare ($25-50):**
- Requires a decent win or saving up
- Shows commitment
- Not everyone will have these

**Epic ($75-150):**
- Serious flex
- "I'm invested in this app"
- Status symbol

**Legendary ($250-500):**
- Whale bait
- FOMO from limited stock
- Ultimate bragging rights
- Drives engagement ("I need to see someone with that title")

### Loss Aversion Angle
"You're up $200 from Blackjack. You could cash out... OR you could buy 'Built Different' and flex forever."

The title is a permanent asset. The $100 might get lost in the next session. **Make the win TANGIBLE.**

---

## Next Steps

1. Build title shop UI
2. Add inventory system
3. Leaderboard integration (show equipped title)
4. Analytics on purchase rates per tier
5. A/B test limited stock vs unlimited
6. Monitor which titles drive most grinding

**Success metric:** % of players with casinoBalance > $0 who purchase at least one title.

**Hypothesis:** Titles create a reason to accumulate casino money instead of gambling it all away. Players will grind casino games to afford aspirational titles.
