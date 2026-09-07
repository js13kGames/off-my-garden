# Unicorns Off My Lawn!

A js13kGames 2026 entry (theme: **"Unicorns and Rainbows"**). You are a leprechaun
tending a rainbow garden while careless, easily-distracted unicorns wander in and
trample your flowers. They aren't evil — they're just big, dumb, and hungry. Herd
them away, sell your blooms, and keep the garden alive.

Inspired by Plants vs. Zombies' readability, but the core is **garden management +
herding**, not shooting: grow valuable things while continuously shaping unicorn
traffic around them.

## Core loop

1. Flowers grow in beds over time; mature flowers pulse with a halo.
2. Unicorns enter from the screen edges (announced by an edge warning), wander the
   open paths between beds, and occasionally **notice** a flower — brief pause,
   thought bubble — then walk over and trample it.
3. The player taps the ground to send the leprechaun places, taps mature flowers to
   sell them for coins, and uses three tools to redirect unicorns.
4. Waves escalate continuously: bigger rosters, more nervous unicorns, less
   reaction time. When a wave's unicorns are all gone, flowers wither and
   reset and the next wave starts right away — no menu, no pause.

## Screen & layout

- **Mobile-first, desktop-friendly.** Portrait phone is the canonical viewport.
- **Fixed logical viewport** (360×640) scaled to fit any physical screen,
  letterboxed on desktop. Game geometry is identical everywhere.
- **One garden = one screen. No camera, no scrolling, no minimap.**
- Layout: thin top HUD (coins) → garden playfield (~85% of screen) → thin
  bottom toolbar. No permanent explanation panels.
- **Five asymmetric flower beds** (A–E) with broad open walkways between them —
  the walkways are where the game happens; unicorns should spend most of their
  time walking harmlessly between beds.
- 6–8 unicorn spawn points around the screen edges.

```
┌──────────────────────────────┐
│ 💰 125                       │  ← compact HUD
├──────────────────────────────┤
│   [A]              [B]       │
│                              │
│           [C]     🦄💭       │
│      ☘️        🧙            │
│   [D]              [E]  🦄❗ │
├──────────────────────────────┤
│ 🔊 10💰  ☘️ 15💰  🌈 20💰    │  ← tools, priced — tap to buy & use
└──────────────────────────────┘
```

## Entities & rules

### Flowers
- Beds are pre-seeded; every flower resets to stage 0 at each wave start and
  grows through stages over time within the wave.
- **Trampled** flower: flattened; stays down for the rest of the wave.
- **Mature** flower: subtle pulsing halo (no permanent coin icons). Tap to sell:
  `+coins` popup; the flower stays sold for the rest of the wave.
- All flowers come back at stage 0 when the next wave begins.

### Unicorns
- State machine: `enter → wander → NOTICE → walk-to-flower → trample → wander/leave`.
- **NOTICE** is the telegraph: the unicorn stops ~0.5–0.8 s with a thought bubble
  before turning toward a flower. That pause is the player's reaction window.
- **Moods**: calm vs. nervous. Nervous unicorns move faster and notice in ~250 ms
  instead of ~700 ms — mood shortens the player's reaction time, not just speed.
  Nervous unicorns show agitated eyes/motion.
- Incoming unicorns are announced with a small edge marker (`!`) before entering.
- Early game: only 2–4 unicorns simultaneously.

### Leprechaun
- Tap the ground → he runs there (movement takes time; he is a character, not a
  cursor). Positioning is a real decision.

### Tools (bottom toolbar)
Each button shows its price. Tap it (or press `1`/`2`/`3`) to buy and fire it
immediately, spending straight from the coin bank — no stock, no shop.
Unaffordable tools are grayed out.
- 🔊 **Noisemaker** — select, tap a location: the leprechaun runs there and, when
  close enough, scares nearby unicorns away. Requires proximity.
- ☘️ **Repellent** — placed on the ground; unicorns avoid its visible radius.
- 🌈 **Attractor** — placed on the ground; lures unicorns within its radius.

### Visual language (small-screen readability)
- Mature flower = glow + sparkle; nervous unicorn = agitated eyes; flower noticed =
  pause + thought bubble; repellent/attractor = visible radius; incoming unicorn =
  edge warning.

## Game structure

A wave ends when every unicorn it spawned has left the field; then flowers
wither, reset, and the next wave begins right away. There is **no win condition** —
waves escalate forever. The lose condition is the garden dying: when the last
flower is gone the run ends immediately, scored by waves survived and coins
collected.

It exists to answer one question:

> Is manipulating silly unicorn traffic while desperately protecting a garden fun?

Candidate structures for the full game (post-POC):
- **Rainbow power** — a meter that fills as flowers are sold; at max, a big rainbow
  celebration shines across the screen, the meter resets, and completed rainbows
  are counted indefinitely with a recorded best.
- **Timed session** — fixed length, score at the end.

## Tech

- **TypeScript + Vite + Biome**, pnpm, `vite-plugin-singlefile`, advzip — the same
  pipeline as the sibling TurboToot project. Zip size measured from the start.
- **Canvas 2D**, no game engine: custom fixed-step loop, custom steering, procedural
  graphics (circles, curves, polygons). ZzFX considered later for sound.
- 13 KB zipped budget.

### Reuse from TurboToot (`../TurboToot`)

The first three TurboToot commits are game-agnostic and should be reused directly
(cherry-pick or copy):

- `4bbaf1c` **001** — TypeScript + Vite + advzip pipeline, Biome, full-window canvas.
- `54cb099` **002** — canvas setup and fixed-step main loop.
- `eb56c5d` **003** — basic game states and start interaction.

Everything from `fa09eca` (004, terrain generation) onward is specific to the
runner game and does not apply here.

## Tickets

POC implementation is broken into numbered tickets in [`tickets/`](tickets/),
designed to be done in order, each leaving the game runnable.
