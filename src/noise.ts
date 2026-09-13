import { ctx } from "./canvas";
import { waterFlowers } from "./garden";
import { lep } from "./leprechaun";
import { Sfx, sfx } from "./music";
import { scareUnicorns } from "./unicorn";

const RING_DURATION = 1;
export const RING_MAX = 100;
// The bottle's reach is arm's length, not a shout's: wide enough for the bed
// he's standing in (BED_RADIUS is 36), too small to catch a neighbouring one.
export const WATER_MAX = 55;
let ringT = 1; // starts finished (no animation)
// The ring is anchored where the noisemaker went off; the lep can walk
// away mid-ring and both the visual and the scare front must stay put.
let ox = 0;
let oy = 0;
// Which flavour of ring is sweeping: the noisemaker's scare front, or the
// water bottle's growth boost. Same expanding-circle-as-hitbox in both cases,
// so one ring serves both rather than a second near-identical module — and
// the busy gate that already stops two noisemakers overlapping covers this too.
let watering = false;

export function startRing(water = false) {
  ringT = 0;
  ox = lep.x;
  oy = lep.y;
  watering = water;
  sfx(water ? Sfx.Water : Sfx.Ring);
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
    if (watering) {
      waterFlowers(ox, oy, eased * WATER_MAX);
    } else {
      scareUnicorns(ox, oy, eased * RING_MAX);
    }
  }
}

export function drawNoise() {
  if (ringT >= 1) {
    return;
  }
  // ease-out: t * (2 - t)
  const t = ringT;
  const eased = t * (2 - t);
  const r = eased * (watering ? WATER_MAX : RING_MAX);
  ctx.strokeStyle = watering
    ? "rgba(120,180,255,0.7)"
    : "rgba(180,180,180,0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(ox, oy, r, 0, Math.PI * 2);
  ctx.stroke();
}
