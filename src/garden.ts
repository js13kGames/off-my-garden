import { ctx, VIEW_H, VIEW_W } from "./canvas";

// Playfield strips: HUD above, toolbar below — later tickets fill them in.
export const FIELD_TOP = 40;
export const FIELD_BOTTOM = 580;

// Grass tufts: three thin blades fanned out from a point, scattered once at
// startup. Purely decorative — flat green reads as a void, this reads as lawn.
// Placement is best-candidate sampling: for each tuft, throw a handful of
// random points and keep whichever lands farthest from the tufts already
// placed. Uniform random clumps and leaves bald patches; this spreads out on
// its own, with none of the grid alignment a jittered lattice can betray.
const TUFT_COUNT = 45;
const CANDIDATES = 8;
const TUFTS: { x: number; y: number }[] = [];
for (let n = 0; n < TUFT_COUNT; n++) {
  let bestX = 0;
  let bestY = 0;
  let bestDist = -1;
  for (let c = 0; c < CANDIDATES; c++) {
    const x = Math.random() * VIEW_W;
    const y = Math.random() * VIEW_H;
    // distance to the nearest tuft placed so far — Infinity for the first one,
    // which makes its candidate throw an ordinary uniform pick
    let dist = Infinity;
    for (const t of TUFTS) {
      dist = Math.min(dist, Math.hypot(t.x - x, t.y - y));
    }
    if (dist > bestDist) {
      bestDist = dist;
      bestX = x;
      bestY = y;
    }
  }
  TUFTS.push({ x: bestX, y: bestY });
}

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

export type Bed = {
  x: number;
  y: number;
  w: number;
  h: number;
  flowers: Flower[];
};

// Full growth takes ~20 s, with per-flower variance so beds don't pulse in sync
const GROW_TIME = 20;
// How long a trampled flower stays flattened before the slot goes bare
const FLAT_TIME = 1.2;
// How long a surviving flower takes to droop away between waves
const WITHER_TIME = 1.2;

function makeBed(x: number, y: number, hue: number): Bed {
  const w = 96;
  const h = 66;
  const flowers: Flower[] = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      flowers.push({
        x: x + 20 + c * 28,
        y: y + 20 + r * 28,
        growth: 0,
        rate: (0.8 + Math.random() * 0.4) / GROW_TIME,
        hue,
        state: FlowerState.Growing,
        anim: 0,
      });
    }
  }
  return { x, y, w, h, flowers };
}

// Asymmetric five-bed arrangement (A–E) with broad open walkways between beds
export const beds: Bed[] = [
  makeBed(28, 66, 340), // A — tulips
  makeBed(236, 66, 50), // B — daisies
  makeBed(132, 258, 315), // C — blossoms
  makeBed(28, 428, 40), // D — sunflowers
  makeBed(236, 462, 275), // E — violets
];

// Flattens a flower; it stays gone for the rest of the wave once the
// flatten animation (below) finishes.
export function trample(f: Flower) {
  f.state = FlowerState.Trampled;
  f.anim = FLAT_TIME;
}

// Visible, alive, and hittable — what unicorns notice/trample and what the
// player can sell. A flower under this stays a no-op for both.
export const standing = (f: Flower) =>
  f.state === FlowerState.Growing && f.growth >= 0.33;

// Fingers are fat and flowers sit 28 px apart — half that spacing is a
// generous target that still can't hit two flowers at once.
const SELL_RADIUS = 14;
// Harvesting needs the lep nearby (of the bed, not the exact flower) so
// selling isn't free from across the garden — he has to tend the patch.
const SELL_RANGE = 50;

function distToBed(bed: Bed, x: number, y: number) {
  const cx = Math.min(Math.max(x, bed.x), bed.x + bed.w);
  const cy = Math.min(Math.max(y, bed.y), bed.y + bed.h);
  return Math.hypot(x - cx, y - cy);
}

// Nearest mature flower under a tap, harvested back to a bare sprout, but
// only in beds the lep is standing close to. Out-of-range or immature-flower
// taps fall through to the lep, e.g. as ordinary ground movement.
export function sellAt(
  x: number,
  y: number,
  lepX: number,
  lepY: number,
): Flower | undefined {
  let best: Flower | undefined;
  let bestDist = SELL_RADIUS;
  for (const bed of beds) {
    if (distToBed(bed, lepX, lepY) > SELL_RANGE) {
      continue;
    }
    for (const f of bed.flowers) {
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
  for (const bed of beds) {
    for (const f of bed.flowers) {
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
    for (const f of bed.flowers) {
      if (f.state === FlowerState.Growing && f.growth > 0) {
        f.state = FlowerState.Withering;
        f.anim = WITHER_TIME;
      }
    }
  }
}

export function updateGarden(dt: number) {
  for (const bed of beds) {
    for (const f of bed.flowers) {
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
    // mature: subtle pulsing halo instead of a permanent icon
    const pulse = 0.5 + 0.5 * Math.sin(time * 4 + f.x);
    ctx.fillStyle = `hsla(${f.hue},90%,70%,${0.15 + 0.15 * pulse})`;
    ctx.beginPath();
    ctx.arc(0, -6, 11 + 2 * pulse, 0, 7);
    ctx.fill();
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
    // soil patch
    ctx.fillStyle = "#6b4a2c";
    ctx.beginPath();
    ctx.roundRect(bed.x, bed.y, bed.w, bed.h, 10);
    ctx.fill();
    ctx.strokeStyle = "#54371f";
    ctx.lineWidth = 3;
    ctx.stroke();
    for (const f of bed.flowers) {
      drawFlower(f, time);
    }
  }
}
