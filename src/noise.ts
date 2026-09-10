import { ctx } from "./canvas";
import { lep } from "./leprechaun";

const RING_DURATION = 1;
export const RING_MAX = 100;
let ringT = 1; // starts finished (no animation)

export function startRing() {
  ringT = 0;
}

export function isRingBusy(): boolean {
  return ringT < 1;
}

export function updateNoise(dt: number) {
  if (ringT < 1) {
    ringT = Math.min(1, ringT + dt / RING_DURATION);
  }
}

export function drawNoise() {
  if (ringT >= 1) {
    return;
  }
  // ease-out: t * (2 - t)
  const t = ringT;
  const eased = t * (2 - t);
  const r = eased * RING_MAX;
  ctx.strokeStyle = "rgba(180,180,180,0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(lep.x, lep.y, r, 0, Math.PI * 2);
  ctx.stroke();
}
