# Unicorns Off My Lawn

A js13kGames 2026 entry (theme: **"Unicorns and Rainbows"**). You are a leprechaun
tending a rainbow garden while careless, easily-distracted unicorns wander in and
trample your flowers. They aren't evil, they're just big, dumb, and clumsy. Herd
them away, harvest your blooms, and paint a rainbow before the garden is mulch.

## Core loop

1. Flowers grow in three loose beds through sprout → bud → bloom.
2. Unicorns enter from the screen edges, wander, then **notice** a flower and
   walk over to stomp it.
3. The player taps the ground to send the leprechaun places, taps (or walks over)
   mature flowers to harvest them, and spends coins on four tools that fire
   wherever the leprechaun stands.
4. Harvests fill the rainbow meter. Fill it and the run is won.

## Screen & layout

- **Mobile-first, desktop-friendly.** Portrait phone is the canonical viewport.
- **Fixed logical viewport** (360×640) scaled to fit any screen, letterboxed.
  Game geometry is identical everywhere (`src/canvas.ts`).
- **One garden = one screen.** No camera, no scrolling, no minimap.
- Thin top HUD (coins, rainbow meter, music toggle, reset) → playfield →
  toolbar strip of four buttons.
- Corner woodland is procedural: a depth function around the field perimeter,
  baked once into an offscreen canvas and blitted each frame.

```
┌──────────────────────────────┐
│ 💰 125      ▓▓▓░░ 🌈   🔊 ↺ │  ← coins, rainbow meter, music, reset
├──────────────────────────────┤
│              [A]             │
│                    🦄💭      │
│   [B]                        │
│              🧙              │
│              [C]        🦄❗ │
├──────────────────────────────┤
│ 🔊30  ☘️40  💎50  💧20       │  ← tools, priced — tap to buy & fire
└──────────────────────────────┘
```

## Entities & rules

### Flowers (`src/garden.ts`)

- Three beds, scattered by best-candidate sampling so clumps look natural.
  Each flower has a random hue (one of seven rainbow bands) and one of several
  procedural petal layouts - beds always come up mixed.
- Growth is per-flower with variance; **bloom** (growth 1) pulses with a halo and
  is the only state that can be harvested or noticed by a unicorn.
- **Trampled** flowers flatten and stay down for the season. **Harvested** ones
  are banked: they leave the ruin pool instead of padding it.
- **Ruin line**: the season is lost when stomps reach ~70% of what was left to
  defend (with a floor, so an almost-empty garden can't die to one stomp).
  Harvesting shrinks the pool but never drops the line below the stomps already
  taken - only a unicorn can end a season.

### Unicorns (`src/unicorn.ts`)

- States: `Warn → Wander → Notice → Target → (trample) → Wander/Leave`, plus
  `Scared` and `Lured`.
- **Notice** is the telegraph: ~0.7 s pause with a thought bubble before turning
  toward a flower.
- **Moods**: calm (speed 40) vs. nervous (speed 62, notice cut to 0.25 s). Wave 1
  is all calm; the nervous share climbs with the wave.
- A committed unicorn goes on a **spree** through the bed it picked.
- The leprechaun's own body pushes unicorns away within 32 px - free, always-on
  counterplay, weaker than a repellent.

### Leprechaun (`src/leprechaun.ts`)

- Tap the ground → he runs there. Crossing the garden takes ~5 s; he's a
  character, not a cursor, and positioning is the real decision. Sprite paths are
  lifted verbatim from `layout/lep.svg` via `Path2D`.

### Tools (`src/toolbar.ts`)

Every tool fires **where the leprechaun stands**, so walking him there is the
cost. Prices are paid straight from the coin bank; unaffordable, busy, gated, or
no-op tools grey out.

- 🔊 **Noise** (30) — expanding ring that scares unicorns as the drawn circle
  reaches them (`src/noise.ts`).
- ☘️ **Repel** (40) — 46 px field unicorns steer around; expires after 12 s.
- 💎 **Attract** (50) — 100 px lure that pulls unicorns off the beds.
- 💧 **Water** (20) — same ring, boosting growth (×1.5 for the wave) of the
  flowers it sweeps.
  Greys out when there are flowers in reach and every one of them is already
  watered or mature — on bare ground it stays live.

### Weather (`src/rain.ts`)

Clouds gather once the season is most of the way to ruin, so a loss is announced
rather than arriving out of a blue sky; the full downpour belongs to the game
over itself.

### Audio (`src/music.ts`)

Hand-rolled WebAudio step sequencer — three tracks (play/win/lose) as compact
data tables, plus one-shot SFX sharing the same note primitive and master gain,
so one mute covers both. Unlocks on first tap and parks the context when the tab
is hidden.

## Game structure

- **Waves/seasons** (`src/wave.ts`) escalate by formula, not a table: roster
  `6 + 3(w-1)`, concurrent cap up to 8, spawn interval down to 1.2 s.
- Wave ends when the roster is spent and the stragglers are walking off; a 4 s
  **harvest grace** lets the player cash in survivors before they wither.
- **Win**: fill the rainbow meter — 30 points, where a lone harvest is 1 and
  chaining same-coloured harvests pays up to 3. The arc draws in; taps are
  ignored until the reveal finishes.
- **Lose**: stomps cross the ruin line. The card holds for 2 s so the tap that
  lost the run can't bounce off it.

## Tutorial (`src/tutorial.ts`)

Ten scripted steps on a practice garden with no wins, losses, or coin carryover:
move, growth, harvest, coins, rainbow, unicorn threat, the noisemaker, the other
tools, the losing condition (demonstrated with the warning sky), and go. Action
steps wait for the real action; hint steps advance on a tap. Completion is
remembered, and the title card always offers a replay.

## Tech

- **TypeScript + Vite + Biome**, pnpm, `vite-plugin-singlefile`, terser, advzip.
  13 kB zipped budget — currently ~12.9 kB.
- **Canvas 2D**, no engine: fixed-step loop, custom steering, procedural art
  (circles, curves, `Path2D` traced from the Inkscape files in `layout/`).
- `const enum` for entity states — it erases entirely and costs no bundle bytes.

## Commands

```sh
pnpm dev              # vite dev server
pnpm lint             # biome check
pnpm typecheck        # tsc
pnpm build            # tsc + vite build + advzip → dist.zip (prints the size)
pnpm check:tutorial   # tutorial regression check
pnpm check:gameplay   # gameplay regression check
```

Both checks run the real TypeScript modules headlessly through Vite's SSR
loader (`scripts/*.ts`) — asserts, no test framework.

## Tickets

Remaining ideas live in [`tickets/`](tickets/); the delivered ones are in
[`tickets/archived/`](tickets/archived/).
