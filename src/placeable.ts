import { ctx } from "./canvas";
import { Sfx, sfx } from "./music";

export type Placeable = { x: number; y: number; life: number };

// Two arrays rather than a kind field: the array a placeable lives in is the
// discriminator, and an exported const enum would stop erasing.
export const repellents: Placeable[] = [];
export const attractors: Placeable[] = [];

// Wide enough to cover a whole flower cluster, so one repellent shields an
// entire bed rather than half of it.
export const REPEL_RADIUS = 46;
// The lure has to reach across a walkway to pull a unicorn off a bed it is
// already walking at, so its pull is far wider than the repellent's push.
// The drawn circle is exactly this radius — no invisible extra reach.
const ATTRACT_RADIUS = 100;
// Placeables expire so the garden doesn't stay fenced off with permanent
// repellents/attractors bought over a long run. The lure goes first: it drags
// traffic where the player wants it, which is worth more than a fence, so it
// has to be re-bought twice as often.
const REPEL_LIFE = 12;
const ATTRACT_LIFE = 6;
// Alpha ramps down over the last seconds so the player sees it about to go.
// Nearly half the lifetime either way: two seconds of fade read as a sudden
// pop-out, and the point is to give time to react before the lawn is open again.
const REPEL_FADE = 5;
const ATTRACT_FADE = 2.5;

export function placeRepellent(x: number, y: number) {
  repellents.push({ x, y, life: REPEL_LIFE });
  sfx(Sfx.Place);
}

export function placeAttractor(x: number, y: number) {
  attractors.push({ x, y, life: ATTRACT_LIFE });
  sfx(Sfx.Place);
}

function expire(items: Placeable[], dt: number) {
  for (let i = items.length - 1; i >= 0; i--) {
    items[i].life -= dt;
    if (items[i].life <= 0) {
      items.splice(i, 1);
    }
  }
}

export function updatePlaceables(dt: number) {
  expire(repellents, dt);
  expire(attractors, dt);
}

/** True inside any repellent radius — the single test all steering routes through. */
export function inRepellent(x: number, y: number): boolean {
  for (const p of repellents) {
    if (Math.hypot(x - p.x, y - p.y) < REPEL_RADIUS) {
      return true;
    }
  }
  return false;
}

/** Closest attractor pulling on this point — the lure counterpart of inRepellent. */
export function nearestAttractor(x: number, y: number): Placeable | undefined {
  let best: Placeable | undefined;
  let bestDist = ATTRACT_RADIUS;
  for (const p of attractors) {
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

function drawField(
  items: Placeable[],
  time: number,
  radius: number,
  fadeTime: number,
  fill: string,
  edge: string,
  glyph: string,
  glyphColor: string,
) {
  for (const p of items) {
    const fade = Math.min(1, p.life / fadeTime);
    // breathing edge so the area reads as active, not as scenery
    const pulse = 0.5 + 0.5 * Math.sin(time * 3 + p.x);
    ctx.fillStyle = `rgba(${fill},${0.1 * fade})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, 7);
    ctx.fill();
    ctx.strokeStyle = `rgba(${edge},${(0.4 + 0.25 * pulse) * fade})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    // solid colour matters: where the emoji falls back to a monochrome glyph
    // it would otherwise inherit the near-transparent tint above
    ctx.globalAlpha = fade;
    ctx.fillStyle = glyphColor;
    ctx.font = "16px sans-serif";
    ctx.fillText(glyph, p.x, p.y);
    ctx.globalAlpha = 1;
  }
}

export function drawPlaceables(time: number) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // cool violet for the lure against the repellent's green, so the two fields
  // stay tellable apart at a glance when both are on the lawn
  drawField(
    attractors,
    time,
    ATTRACT_RADIUS,
    ATTRACT_FADE,
    "150,110,230",
    "120,80,210",
    "\u{1F48E}",
    "#5b3aa8",
  );
  drawField(
    repellents,
    time,
    REPEL_RADIUS,
    REPEL_FADE,
    "60,180,90",
    "40,150,70",
    "\u2618\uFE0F",
    "#1f6b33",
  );
  ctx.textBaseline = "alphabetic";
}
