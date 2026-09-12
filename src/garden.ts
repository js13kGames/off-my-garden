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

// Woodland crowding the four corners of the clearing. No sprites and no
// per-tree data: the whole silhouette is a depth around the field perimeter,
// weighted to the corners and wobbled by two sines whose frequencies (9 and 14)
// never line up around the loop — so no two corners look like copies of each
// other. The edge midruns stay bare so the lawn keeps its open sides.
const CANOPY_STEPS = 160;
const CANOPY_CORNER = 60; // depth at a corner; falls to nothing by mid-edge
const CANOPY_WOBBLE = 6;
// Crowns swell and shrink this many times around the loop, so neighbouring
// circles differ in size and the union bulges instead of tracing a smooth
// offset. It has to stay well above the two depth frequencies: a corner is only
// ~80 px of a 1800 px perimeter, and a lobe longer than that leaves the corner
// a straight 45° chamfer.
const CANOPY_LOBE = 29;
// Floor on the crown radius: along the thin edge midruns the depth alone would
// give circles too small to overlap at this step spacing, and the union would
// break into beads. Their centres just sit further outside the field instead.
const CANOPY_MIN_R = 12;
// How much deeper than wide each crown is
const CANOPY_BULGE = 1.45;

// Stamps one pass of crowns as overlapping circles along the field perimeter,
// at `scale` of full depth with the lobes shifted by `phase` so the passes
// don't bulge in lockstep. All circles wind the same way and go into one path,
// so a single nonzero fill unions them — no seams between neighbours, and the
// only boundary left is the round-edged silhouette their outsides trace.
function canopyPass(scale: number, phase: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  const height = FIELD_BOTTOM - FIELD_TOP;
  const perimeter = 2 * (VIEW_W + height);
  for (let step = 0; step <= CANOPY_STEPS; step++) {
    const fraction = step / CANOPY_STEPS;
    const along = fraction * perimeter;
    let x = 0;
    let y = FIELD_TOP;
    let nx = 0;
    let ny = 0;
    if (along < VIEW_W) {
      x = along; // top edge, left to right, inward is down
      ny = 1;
    } else if (along < VIEW_W + height) {
      x = VIEW_W; // right edge, downward
      y = FIELD_TOP + along - VIEW_W;
      nx = -1;
    } else if (along < 2 * VIEW_W + height) {
      x = 2 * VIEW_W + height - along; // bottom edge, right to left
      y = FIELD_BOTTOM;
      ny = -1;
    } else {
      y = FIELD_BOTTOM - (along - 2 * VIEW_W - height); // left edge, upward
      nx = 1;
    }
    // field coords in -1..1; on the perimeter one of the two is always ±1, so
    // their product is 0 at an edge midpoint and 1 at a corner. The 4th power
    // is what keeps the trees in the corners: it has collapsed to 0.06 by the
    // quarter mark, and everything below is scaled by it — wobble included, so
    // the midruns can't sprout a stray crown.
    const u = (x / VIEW_W) * 2 - 1;
    const v = ((y - FIELD_TOP) / height) * 2 - 1;
    const corner = (u * v) ** 4;
    const angle = fraction * Math.PI * 2;
    const depth =
      scale *
      corner *
      (CANOPY_CORNER +
        (CANOPY_WOBBLE * (Math.sin(angle * 9) + Math.sin(angle * 14 + 2))) / 2);
    // How far this crown reaches into the field. The circle is then sized and
    // placed so its inner rim lands exactly there, whatever the radius floor
    // does to its centre.
    const reach =
      depth * (0.5 + 0.5 * Math.abs(Math.sin(angle * CANOPY_LOBE + phase)));
    const radius = Math.max(CANOPY_MIN_R, reach * 0.8);
    // Stretched along the normal, not across it: the width along the edge is
    // pinned by the step spacing (shrink it and the union breaks up), so the
    // extra bulge has to go inward, which is what makes each crown read as a
    // round lobe instead of a shallow ripple.
    const bulge = radius * CANOPY_BULGE;
    const cx = x + nx * (reach - bulge);
    const cy = y + ny * (reach - bulge);
    // each crown its own subpath — without the moveTo, ellipse() would join to
    // the previous one with a chord and fill the sliver behind it. The spur
    // from the centre to the arc's start is retraced on the implicit close, so
    // it encloses nothing and the fill ignores it.
    ctx.moveTo(cx, cy);
    // rotate a quarter turn on the side edges so the long axis follows the
    // inward normal there too
    ctx.ellipse(cx, cy, radius, bulge, nx ? Math.PI / 2 : 0, 0, 7);
  }
  ctx.fill();
}

// The corner trees, drawn last of all — over the grass, pebbles, flowers,
// unicorns and the lep — because they overhang the ground rather than being
// painted onto it: anything that wanders under them is shaded, and anything
// under the crowns themselves is hidden.
//
// The shade goes down first and runs deepest, so what shows of it is the fringe
// past the crowns falling on the lawn; the two opaque foliage passes then cover
// the rest of it, a dark mass with lit crowns stacked on top toward the field
// edge, so the corners have volume instead of reading as a flat vignette.
// Crowns that spill
// past the field edge are hidden by the HUD/toolbar strips and the viewport clip.
// ponytail: static art redrawn every frame — bake it into an offscreen canvas
// once if these fills ever show up in a profile.
export function drawCanopy() {
  canopyPass(1, 0, "rgba(0,0,0,0.38)");
  canopyPass(0.7, 1.7, "#135e26");
  canopyPass(0.4, 3.4, "#176b24");
}

export function drawLawn() {
  ctx.fillStyle = "#080";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (const decoration of DECORATIONS) {
    ctx.save();
    ctx.translate(decoration.x, decoration.y);
    ctx.scale(decoration.width, decoration.height);
    ctx.transform(1, 0, decoration.lean, 1, 0, 0);
    if (decoration.pebble) {
      // A squat stone with a quiet top facet reads as ground, not an obstacle.
      ctx.fillStyle = "#68816a";
      ctx.beginPath();
      ctx.moveTo(-3, -1);
      ctx.lineTo(-1.5, -3);
      ctx.lineTo(1, -3.4);
      ctx.lineTo(2.7, -1.8);
      ctx.lineTo(3, -0.4);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#839783";
      ctx.beginPath();
      ctx.moveTo(-3, -1);
      ctx.lineTo(-1.5, -3);
      ctx.lineTo(1, -3.4);
      ctx.lineTo(2.7, -1.8);
      ctx.lineTo(-0.5, -1.5);
      ctx.closePath();
      ctx.fill();
    } else {
      // Unequal, curved blades taper to points and overlap at their roots.
      ctx.fillStyle = "#259529";
      ctx.beginPath();
      ctx.moveTo(-1, 0);
      ctx.quadraticCurveTo(-3, -1, -5, -5);
      ctx.quadraticCurveTo(-1, -4, 0, -1);
      ctx.quadraticCurveTo(-1, -4, 1, -7);
      ctx.quadraticCurveTo(2, -4, 1, -1);
      ctx.quadraticCurveTo(3, -4, 5, -4);
      ctx.quadraticCurveTo(3, -1, 1, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
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

// Grass and pebbles share a scatter so they don't pile onto the same spots.
// Purely decorative — flat green reads as a void, this reads as lawn.
const TUFT_COUNT = 40;
const PEBBLE_COUNT = 7;
const DECORATIONS = scatter(TUFT_COUNT + PEBBLE_COUNT, () => {
  let point: { x: number; y: number };
  // Reserve space for every sprout, including flowers currently gone or growing.
  // Generate after the beds so their actual spawn positions are available.
  do {
    point = {
      x: 12 + Math.random() * (VIEW_W - 24),
      y: FIELD_TOP + 12 + Math.random() * (FIELD_BOTTOM - FIELD_TOP - 24),
    };
  } while (
    beds.some((bed) =>
      bed.some(
        (flower) => Math.hypot(flower.x - point.x, flower.y - point.y) < 14,
      ),
    )
  );
  return point;
}).map((point, index) => ({
  ...point,
  pebble: index < PEBBLE_COUNT,
  width: 0.8 + Math.random() * 0.4,
  height: 0.75 + Math.random() * 0.5,
  lean: Math.random() * 0.6 - 0.3,
}));

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
  const ripe = g >= 1 && f.state === FlowerState.Growing;
  if (ripe) {
    // mature: sway from the stem base — reads as a flower nodding rather than
    // the whole sprite jittering. Phase from x so a bed ripples out of sync.
    ctx.translate(0, 4);
    ctx.rotate(Math.sin(time * 2.2 + f.x * 0.12) * 0.09);
    ctx.translate(0, -4);
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
    if (ripe) {
      // ripe halo: a soft pulsing glow behind the head — the "tap me" tell that
      // survives any petal hue, unlike motion alone
      const p = 0.5 + 0.5 * Math.sin(time * 2.2 + f.x * 0.12);
      ctx.fillStyle = `hsla(${f.hue},90%,70%,${0.15 + 0.2 * p})`;
      ctx.beginPath();
      ctx.arc(0, top, size * (1.9 + 0.35 * p), 0, 7);
      ctx.fill();
    }
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
