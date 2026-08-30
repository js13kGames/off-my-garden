import { ctx } from "./canvas";

export type Placeable = { x: number; y: number; life: number };

export const placeables: Placeable[] = [];

// Roughly half a bed wide — one repellent covers a bed's approach, not the
// whole walkway, so placement is a real decision.
export const REPEL_RADIUS = 46;
// Placeables expire so the garden doesn't stay fenced off; stock caps how many
// can ever exist, expiry keeps the field from filling up.
const LIFE = 12;
// Alpha ramps down over the last seconds so the player sees it about to go
const FADE = 2;

export function placeRepellent(x: number, y: number) {
  placeables.push({ x, y, life: LIFE });
}

export function updatePlaceables(dt: number) {
  for (let i = placeables.length - 1; i >= 0; i--) {
    placeables[i].life -= dt;
    if (placeables[i].life <= 0) {
      placeables.splice(i, 1);
    }
  }
}

/** True inside any repellent radius — the single test all steering routes through. */
export function inRepellent(x: number, y: number): boolean {
  for (const p of placeables) {
    if (Math.hypot(x - p.x, y - p.y) < REPEL_RADIUS) {
      return true;
    }
  }
  return false;
}

export function drawPlaceables(time: number) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const p of placeables) {
    const fade = Math.min(1, p.life / FADE);
    // breathing edge so the area reads as active, not as scenery
    const pulse = 0.5 + 0.5 * Math.sin(time * 3 + p.x);
    ctx.fillStyle = `rgba(60,180,90,${0.1 * fade})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, REPEL_RADIUS, 0, 7);
    ctx.fill();
    ctx.strokeStyle = `rgba(40,150,70,${(0.4 + 0.25 * pulse) * fade})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    // solid colour matters: where the clover falls back to a monochrome glyph
    // it would otherwise inherit the near-transparent tint above
    ctx.globalAlpha = fade;
    ctx.fillStyle = "#1f6b33";
    ctx.font = "16px sans-serif";
    ctx.fillText("\u2618\uFE0F", p.x, p.y);
    ctx.globalAlpha = 1;
  }
  ctx.textBaseline = "alphabetic";
}
