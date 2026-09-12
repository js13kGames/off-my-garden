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

// Storm ramps in rather than popping on — same k = min(1, t/TIME) idiom as
// the rainbow arc's draw-in.
const RAMP_TIME = 1.2;
let rainT = 0;

/** Clears the storm so a restart doesn't start mid-downpour. */
export function resetRain() {
  rainT = 0;
}

export function updateRain(dt: number) {
  rainT = Math.min(RAMP_TIME, rainT + dt);
  for (const d of drops) {
    d.y += d.speed * dt;
    if (d.y > FIELD_BOTTOM) {
      d.y = FIELD_TOP;
      d.x = Math.random() * VIEW_W;
    }
  }
}

export function drawRain() {
  const k = rainT / RAMP_TIME;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, FIELD_TOP, VIEW_W, FIELD_BOTTOM - FIELD_TOP);
  ctx.clip();
  ctx.fillStyle = `rgba(10,20,40,${0.35 * k})`;
  ctx.fillRect(0, FIELD_TOP, VIEW_W, FIELD_BOTTOM - FIELD_TOP);
  ctx.strokeStyle = `rgba(190,210,255,${0.6 * k})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const d of drops) {
    // slanted streak: falls down-left, matching a light prevailing wind
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - d.len * 0.3, d.y - d.len);
  }
  ctx.stroke();
  ctx.restore();
}
