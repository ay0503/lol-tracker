# $DORI Casino Name Effects

Visual treatments applied to player display names on the casino leaderboard.

**Psychology**: Glow/shine = status signal. Animation = attention magnet. Color = personality. Most expensive = UNMISSABLE.

---

## COMMON TIER ($10-20)
*Subtle color changes — entry-level personalization*

### 1. **Cherry Red** | $10
- **CSS**: `text-red-500`
- **Visual**: Bright red text, no glow. Classic standout color.

### 2. **Forest Green** | $12
- **CSS**: `text-green-600`
- **Visual**: Deep green text. Money vibes without being obnoxious.

### 3. **Sky Blue** | $12
- **CSS**: `text-blue-400`
- **Visual**: Light blue text. Calm, confident energy.

### 4. **Royal Purple** | $15
- **CSS**: `text-purple-500`
- **Visual**: Solid purple text. Slightly rarer than primary colors.

### 5. **Amber** | $18
- **CSS**: `text-amber-500`
- **Visual**: Warm orange-yellow. Stands out without screaming.

---

## RARE TIER ($30-60)
*Gradients and glows — noticeable status upgrade*

### 6. **Sunset** | $35
- **CSS**: `bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent`
- **Visual**: Orange → pink gradient. Warm, eye-catching fade.

### 7. **Ocean Wave** | $40
- **CSS**: `bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent`
- **Visual**: Deep blue → bright cyan. Cool, fluid gradient.

### 8. **Toxic** | $45
- **CSS**: `bg-gradient-to-r from-lime-400 to-green-600 bg-clip-text text-transparent`
- **Visual**: Bright lime → deep green. Radioactive energy.

### 9. **Gold Rush** | $50
- **CSS**: `text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]`
- **Visual**: Golden text with soft yellow glow. Classic wealth signal.

### 10. **Neon Pink** | $55
- **CSS**: `text-pink-400 drop-shadow-[0_0_10px_rgba(244,114,182,0.8)]`
- **Visual**: Hot pink with bright glow. Club/arcade aesthetic.

### 11. **Ice Cold** | $60
- **CSS**: `text-cyan-300 drop-shadow-[0_0_12px_rgba(103,232,249,0.7)]`
- **Visual**: Pale cyan with icy blue glow. Frosty, aloof energy.

---

## EPIC TIER ($100-200)
*Animations and special treatments — hard to miss*

### 12. **Rainbow Cycle** | $120
- **CSS**: `animate-[rainbow_3s_linear_infinite]` + gradient keyframes across spectrum
- **Visual**: Name cycles through full rainbow. Constant slow color shift.

### 13. **Pulse** | $130
- **CSS**: `animate-pulse text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.9)]`
- **Visual**: Red text with pulsing glow (dim → bright → dim). Heartbeat rhythm.

### 14. **Shimmer** | $150
- **CSS**: `bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200 bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite] bg-clip-text text-transparent`
- **Visual**: Gold gradient with light reflection sliding left → right. Metallic sheen.

### 15. **Purple Haze** | $160
- **CSS**: `text-purple-400 drop-shadow-[0_0_20px_rgba(192,132,252,0.9)] animate-[glow_2s_ease-in-out_infinite]`
- **Visual**: Purple text with pulsing purple haze. Mystical, smoky aura.

### 16. **Inferno** | $180
- **CSS**: `bg-gradient-to-t from-red-600 via-orange-500 to-yellow-400 bg-clip-text text-transparent animate-[flicker_1.5s_ease-in-out_infinite]`
- **Visual**: Fire gradient (red → orange → yellow) with flicker animation. Flames rising.

### 17. **Electric Storm** | $200
- **CSS**: `text-blue-300 drop-shadow-[0_0_25px_rgba(147,197,253,1)] animate-[lightning_0.5s_ease-in-out_infinite]`
- **Visual**: Bright blue with intense glow, random brightness spikes. Lightning strikes.

---

## LEGENDARY TIER ($300-500)
*Over-the-top — everyone stops scrolling*

### 18. **Diamond Sparkle** | $350
- **CSS**: `bg-gradient-to-br from-blue-100 via-white to-blue-100 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(255,255,255,1)] animate-[sparkle_3s_linear_infinite]`
- **Visual**: White-blue gradient with rotating sparkle highlights. Particles shimmer across name.
- **Extra**: Small star/sparkle emoji before name (optional)

### 19. **Molten Gold** | $400
- **CSS**: `bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 bg-[length:200%_100%] bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(234,179,8,1)] animate-[flow_2s_linear_infinite]`
- **Visual**: Dark gold → bright gold → dark gold flowing gradient with intense golden aura. Liquid metal effect.

### 20. **Cosmic Void** | $500
- **CSS**: `bg-gradient-to-r from-purple-900 via-pink-500 to-purple-900 bg-[length:300%_100%] bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(168,85,247,1)_0_0_20px_rgba(236,72,153,1)] animate-[cosmic_4s_ease-in-out_infinite]`
- **Visual**: Deep purple → hot pink → deep purple with dual-layer glow (purple outer, pink inner). Slowly shifting nebula effect. THE status symbol.

---

## Implementation Notes

### CSS Animations to Define

```css
@keyframes rainbow {
  0%, 100% { filter: hue-rotate(0deg); }
  50% { filter: hue-rotate(360deg); }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes glow {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.5); }
}

@keyframes flicker {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
  75% { opacity: 0.9; }
}

@keyframes lightning {
  0%, 90%, 100% { filter: brightness(1); }
  95% { filter: brightness(2.5); }
}

@keyframes sparkle {
  0%, 100% { filter: brightness(1) saturate(1); }
  33% { filter: brightness(1.5) saturate(1.3); }
  66% { filter: brightness(1) saturate(1); }
}

@keyframes flow {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}

@keyframes cosmic {
  0%, 100% { background-position: 0% 50%; filter: brightness(1); }
  50% { background-position: 100% 50%; filter: brightness(1.3); }
}
```

### Tailwind Config Addition

Add to `tailwind.config.js`:

```js
animation: {
  'rainbow': 'rainbow 3s linear infinite',
  'shimmer': 'shimmer 2s linear infinite',
  'glow': 'glow 2s ease-in-out infinite',
  'flicker': 'flicker 1.5s ease-in-out infinite',
  'lightning': 'lightning 0.5s ease-in-out infinite',
  'sparkle': 'sparkle 3s linear infinite',
  'flow': 'flow 2s linear infinite',
  'cosmic': 'cosmic 4s ease-in-out infinite',
}
```

---

## Pricing Strategy

- **Common**: Impulse buy range. Gateway cosmetic.
- **Rare**: Noticeable but not painful. Most popular tier.
- **Epic**: Flex territory. Animations = attention = worth it.
- **Legendary**: Status symbol. "I'm serious about this casino" energy.

## Display on Leaderboard

Apply effect class to the player name element:
```tsx
<span className={getNameEffectClass(player.equippedNameEffect)}>
  {player.name}
</span>
```

Players can purchase effects in the casino shop, equip them in settings, and they persist across sessions via DB.
