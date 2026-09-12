import { ctx, VIEW_W } from "./canvas";
import { FIELD_BOTTOM, FIELD_TOP } from "./garden";

// Game-over weather: a fixed pool of drops that wrap top-to-bottom forever,
// same idiom as the grass tufts — scattered once, no per-frame allocation.
type Drop = { x: number; y: number; speed: number; len: number };
const DROP_COUNT = 90;
const drops: Drop[] = [];
for (let i = 0; i < DROP_COUNT; i++) {
  drops.push({
    x: Math.random() * VIEW_W,
    y: FIELD_TOP + Math.random() * (FIELD_BOTTOM - FIELD_TOP),
    speed: 220 + Math.random() * 140,
    len: 8 + Math.random() * 6,
  });
}

// Storm ramps in rather than popping on, and eases back out if the garden
// stops losing ground — 0 = clear sky, 1 = the game-over downpour.
const RAMP_TIME = 1.2;
let level = 0;

// The weather is the warning: clouds gather once the wave is most of the way
// to ruin, so the loss is announced instead of arriving out of a blue sky. Kept
// below 1 while playing, so the full downpour still belongs to the loss itself.
const STORM_FROM = 0.6;
const WARN_MAX = 0.7;

/** Clears the storm so a restart doesn't start mid-downpour. */
export function resetRain() {
  level = 0;
}

/** `ruin` is the wave's 0..1 progress toward being lost; the loss passes 1. */
export function updateRain(dt: number, ruin = 1) {
  const target =
    ruin >= 1
      ? 1
      : Math.max(0, (ruin - STORM_FROM) / (1 - STORM_FROM)) * WARN_MAX;
  // same rate in both directions — one RAMP_TIME crosses the whole range
  const step = (dt / RAMP_TIME) * Math.sign(target - level);
  level = Math.abs(target - level) < Math.abs(step) ? target : level + step;
  for (const d of drops) {
    d.y += d.speed * dt;
    if (d.y > FIELD_BOTTOM) {
      d.y = FIELD_TOP;
      d.x = Math.random() * VIEW_W;
    }
  }
}

export function drawRain() {
  const k = level;
  if (k <= 0) {
    return; // clear sky
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, FIELD_TOP, VIEW_W, FIELD_BOTTOM - FIELD_TOP);
  ctx.clip();
  ctx.fillStyle = `rgba(10,20,40,${0.35 * k})`;
  ctx.fillRect(0, FIELD_TOP, VIEW_W, FIELD_BOTTOM - FIELD_TOP);
  // A drizzle is few drops, not 90 faint ones: the count grows with the storm
  // alongside the alpha, so the warning reads as weather rather than as a
  // washed-out downpour. Drops are a fixed pool in random positions, so taking
  // the first n of them is already a scattered handful.
  ctx.strokeStyle = `rgba(190,210,255,${0.6 * k})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const n = Math.ceil(DROP_COUNT * k);
  for (let i = 0; i < n; i++) {
    // slanted streak: falls down-left, matching a light prevailing wind
    const d = drops[i];
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - d.len * 0.3, d.y - d.len);
  }
  ctx.stroke();
  ctx.restore();
}
