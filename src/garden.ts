import { ctx, VIEW_H, VIEW_W } from "./canvas";
import { Sfx, sfx } from "./music";

// Playfield strips: HUD above, toolbar below — later tickets fill them in.
export const FIELD_TOP = 40;
export const FIELD_BOTTOM = 580;

// Best-candidate sampling: for each of `count` points, throw a handful of
// random candidates from `pick` and keep whichever lands farthest from the
// points already placed. Uniform random clumps and leaves bald patches; this
// spreads out on its own, with none of the grid alignment a jittered lattice
// can betray. Shared by the grass tufts (spread across the whole lawn) and
// flower clusters (spread within a small disc around a centre).
const CANDIDATES = 8;
function scatter(count: number, pick: () => { x: number; y: number }) {
  const points: { x: number; y: number }[] = [];
  for (let n = 0; n < count; n++) {
    let best = { x: 0, y: 0 };
    let bestDist = -1;
    for (let c = 0; c < CANDIDATES; c++) {
      const p = pick();
      // distance to the nearest point placed so far — Infinity for the first
      // one, which makes its candidate throw an ordinary uniform pick
      let dist = Infinity;
      for (const t of points) {
        dist = Math.min(dist, Math.hypot(t.x - p.x, t.y - p.y));
      }
      if (dist > bestDist) {
        bestDist = dist;
        best = p;
      }
    }
    points.push(best);
  }
  return points;
}

// Grass tufts: three thin blades fanned out from a point, scattered once at
// startup. Purely decorative — flat green reads as a void, this reads as lawn.
const TUFT_COUNT = 45;
const TUFTS = scatter(TUFT_COUNT, () => ({
  x: Math.random() * VIEW_W,
  y: Math.random() * VIEW_H,
}));

export function drawLawn() {
  ctx.fillStyle = "#080";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = "rgba(0,160,0,.7)";
  for (const t of TUFTS) {
    // i = -1/0/1: left blade leaning out, upright blade, right blade
    for (let i = -1; i < 2; i++) {
      ctx.beginPath();
      ctx.ellipse(t.x + i * 1.8, t.y, 1, 5, i * 0.18, 0, 7);
      ctx.fill();
    }
  }
}

// module-local: an exported const enum would stop erasing under isolatedModules
const enum FlowerState {
  Growing,
  Trampled,
  Withering,
  Gone,
}

export type Flower = {
  x: number;
  y: number;
  growth: number; // 0..1, 1 = mature
  rate: number; // growth per second
  hue: number;
  state: FlowerState;
  anim: number; // seconds left in the current death/wither animation
};

// A bed is just a group of flowers now — no rect, no soil, no collision. It
// exists so a rampaging unicorn can commit to "this clump" and the shop can
// grow bed sizes over time, not because the garden has any tile grid.
export type Bed = Flower[];

// Full growth takes ~20 s, with per-flower variance so beds don't pulse in sync
const GROW_TIME = 20;
// How long a trampled flower stays flattened before the slot goes bare
const FLAT_TIME = 1.2;
// How long a surviving flower takes to droop away between waves
const WITHER_TIME = 1.2;

const FLOWERS_PER_BED = 7;
// How far a bed's flowers scatter from its centre — small enough to read as
// one clump, big enough that petals don't all stack on the same point
const BED_RADIUS = 36;

function makeBed(cx: number, cy: number, hue: number): Bed {
  const flowers = scatter(FLOWERS_PER_BED, () => {
    const a = Math.random() * Math.PI * 2;
    // sqrt-scaled radius: uniform density across the disc instead of
    // clumping toward the centre
    const r = BED_RADIUS * Math.sqrt(Math.random());
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  }).map((p) => ({
    x: p.x,
    y: p.y,
    growth: 0,
    rate: (0.8 + Math.random() * 0.4) / GROW_TIME,
    hue,
    state: FlowerState.Growing,
    anim: 0,
  }));
  // no soil rect to layer on, so draw order has to fake the depth: lower
  // flowers (larger y) drawn last so they sit in front of ones behind them
  flowers.sort((a, b) => a.y - b.y);
  return flowers;
}

// Three loose clumps in an asymmetric zigzag, clear of the HUD/toolbar strips
export const beds: Bed[] = [
  makeBed(245, 155, 340), // tulips
  makeBed(115, 340, 50), // daisies
  makeBed(240, 500, 315), // blossoms
];

// Counts stumped flowers this wave — the game-over trigger. standing() gates
// every trample() call and it requires Growing, which trample() leaves for
// good, so a flower can never be counted twice.
let stumped = 0;

// Flattens a flower; it stays gone for the rest of the wave once the
// flatten animation (below) finishes.
export function trample(f: Flower) {
  f.state = FlowerState.Trampled;
  f.anim = FLAT_TIME;
  stumped++;
  sfx(Sfx.Stomp);
}

// Visible, alive, and hittable — what unicorns notice/trample and what the
// player can sell. A flower under this stays a no-op for both.
export const standing = (f: Flower) =>
  f.state === FlowerState.Growing && f.growth >= 0.33;

// Trampled/sold flowers never come back mid-wave — only resetGarden() does
// that, at the next wave. So no Growing flower left means the wave has
// nothing more to lose, even the sprouts too young for `standing`.
export const gardenBare = () =>
  !beds.some((b) => b.some((f) => f.state === FlowerState.Growing));

// Only stumping loses the garden — harvested and withered flowers are the
// player's own doing, and gardenBare() can't tell the three apart. Every
// flower in every bed has been trampled once stumped hits the total count.
export const gardenStumped = () =>
  stumped === beds.reduce((n, b) => n + b.length, 0);

// Fingers are fat and flowers sit ~23 px apart in a cluster — half that
// spacing is a generous target that still can't hit two flowers at once.
const SELL_RADIUS = 10;
// Harvesting needs the lep nearby the flower itself (not just its bed) so
// selling isn't free from across the garden — he has to tend the patch.
const SELL_RANGE = 50;

// Nearest mature flower under a tap, harvested back to a bare sprout, but
// only among flowers the lep is standing close to. Out-of-range or
// immature-flower taps fall through to the lep, e.g. as ordinary ground movement.
export function sellAt(
  x: number,
  y: number,
  lepX: number,
  lepY: number,
): Flower | undefined {
  let best: Flower | undefined;
  let bestDist = SELL_RADIUS;
  for (const bed of beds) {
    for (const f of bed) {
      if (f.state !== FlowerState.Growing || f.growth < 1) {
        continue;
      }
      if (Math.hypot(f.x - lepX, f.y - lepY) > SELL_RANGE) {
        continue;
      }
      const d = Math.hypot(f.x - x, f.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = f;
      }
    }
  }
  if (best) {
    best.state = FlowerState.Gone;
  }
  return best;
}

// Walking over a mature flower harvests the nearest one within the same
// targeting radius as a click.
export function harvestAtPosition(x: number, y: number): Flower | undefined {
  let best: Flower | undefined;
  let bestDist = SELL_RADIUS;
  for (const bed of beds) {
    for (const f of bed) {
      if (f.state !== FlowerState.Growing || f.growth < 1) {
        continue;
      }
      const d = Math.hypot(f.x - x, f.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = f;
      }
    }
  }
  if (best) {
    best.state = FlowerState.Gone;
  }
  return best;
}

// At each wave start every flower starts over at stage 0, survivors and all —
// waves are self-contained growing seasons, not a garden that just keeps aging.
export function resetGarden() {
  stumped = 0;
  for (const bed of beds) {
    for (const f of bed) {
      f.growth = 0;
      f.state = FlowerState.Growing;
      f.anim = 0;
    }
  }
}

// Before the next wave's reset, send surviving flowers into a droop-and-fade
// so the stage-0 snap reads as an event instead of a jump cut. Already-dead
// flowers (trampled/sold/withered) are left alone.
export function witherGarden() {
  for (const bed of beds) {
    for (const f of bed) {
      if (f.state === FlowerState.Growing && f.growth > 0) {
        f.state = FlowerState.Withering;
        f.anim = WITHER_TIME;
      }
    }
  }
}

export function updateGarden(dt: number) {
  for (const bed of beds) {
    for (const f of bed) {
      if (f.state === FlowerState.Growing) {
        f.growth = Math.min(1, f.growth + f.rate * dt);
        continue;
      }
      if (f.state === FlowerState.Gone) {
        continue;
      }
      f.anim -= dt;
      if (f.anim <= 0) {
        f.state = FlowerState.Gone;
      }
    }
  }
}

function drawFlower(f: Flower, time: number) {
  if (f.state === FlowerState.Gone) {
    return; // bare soil — trampled/sold/withered stays empty for the wave
  }
  const g = f.growth;
  ctx.save();
  ctx.translate(f.x, f.y);
  if (f.state === FlowerState.Trampled) {
    // trample feedback: a fading dust ring plus the crushed petals squashed
    // flat against the soil, both shrinking away as the slot goes bare
    const k = f.anim / FLAT_TIME;
    ctx.strokeStyle = `rgba(180,150,110,${0.5 * k})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 2, 6 + 10 * (1 - k), 0, 7);
    ctx.stroke();
    ctx.scale(1.3, 0.25);
    ctx.fillStyle = `hsla(${f.hue},80%,45%,${k})`;
    ctx.beginPath();
    ctx.arc(0, 2, 5, 0, 7);
    ctx.fill();
    ctx.restore();
    return; // no stem underneath — trampled flowers don't regrow mid-wave
  }
  if (f.state === FlowerState.Withering) {
    // survivor dying back between waves: droop sideways and fade together
    const k = f.anim / WITHER_TIME;
    ctx.globalAlpha = k;
    ctx.rotate((1 - k) * 1.2);
  }
  if (g >= 1 && f.state === FlowerState.Growing) {
    // mature: a slow bob (whole flower, local space) says "collect me" in any
    // hue — phase derives from x so a bed ripples instead of bobbing in sync
    const bob = Math.sin(time * 2.4 + f.x * 0.12) * 2;
    ctx.translate(0, bob);
  }
  // stem grows with the flower
  const stem = 4 + 8 * g;
  ctx.strokeStyle = "#2c7a2c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(0, 4 - stem);
  ctx.stroke();
  const top = 4 - stem;
  if (g < 0.33) {
    // sprout: tiny leaf
    ctx.fillStyle = "#3c9a3c";
    ctx.beginPath();
    ctx.arc(0, top, 2, 0, 7);
    ctx.fill();
  } else {
    // bud → bloom: petals scale up with growth
    const size = g < 0.66 ? 2.5 : 3 + 3 * g;
    ctx.fillStyle = `hsl(${f.hue},80%,${g < 0.66 ? 45 : 60}%)`;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(
        Math.cos(a) * size * 0.8,
        top + Math.sin(a) * size * 0.8,
        size * 0.7,
        0,
        7,
      );
      ctx.fill();
    }
    ctx.fillStyle = "#ffd54a";
    ctx.beginPath();
    ctx.arc(0, top, size * 0.5, 0, 7);
    ctx.fill();
  }
  ctx.restore();
}

export function drawGarden(time: number) {
  for (const bed of beds) {
    for (const f of bed) {
      drawFlower(f, time);
    }
  }
}
