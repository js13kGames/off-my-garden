import { ctx } from "./canvas";
import { lep } from "./leprechaun";
import { scareUnicorns } from "./unicorn";

const RING_DURATION = 1;
export const RING_MAX = 100;
let ringT = 1; // starts finished (no animation)
// The ring is anchored where the noisemaker went off; the lep can walk
// away mid-ring and both the visual and the scare front must stay put.
let ox = 0;
let oy = 0;

export function startRing() {
  ringT = 0;
  ox = lep.x;
  oy = lep.y;
}

export function isRingBusy(): boolean {
  return ringT < 1;
}

export function updateNoise(dt: number) {
  if (ringT < 1) {
    ringT = Math.min(1, ringT + dt / RING_DURATION);
    // The drawn circle IS the effect: a uni is scared only at the frame
    // the expanding ring reaches it, so adjacent unis flee at once while
    // distant ones get a beat of warning. scareUnicorns skips already-
    // scared unis, so sweeping every frame is safe.
    const eased = ringT * (2 - ringT);
    scareUnicorns(ox, oy, eased * RING_MAX);
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
  ctx.arc(ox, oy, r, 0, Math.PI * 2);
  ctx.stroke();
}
