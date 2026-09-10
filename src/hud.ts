import { ctx, VIEW_W } from "./canvas";
import { FIELD_BOTTOM } from "./garden";

// Coins earned by selling flowers; spent on tools the moment they're used.
// Per-use price, paid straight from the coin bank; balance against COIN_VALUE in hud.ts.
export const PRICES = [10, 15, 20];
let coins = PRICES[0] + PRICES[1];
const COIN_VALUE = 5;

type Popup = { x: number; y: number; t: number };
const POP_TIME = 0.9;
const pops: Popup[] = [];

// Rainbow objective: every harvested flower fills the meter; full meter fires
// a celebration sweep and counts a completed rainbow. Purely cosmetic — no
// gameplay effect — so it never touches the coin economy above.
const FLOWERS_PER_RAINBOW = 10;
let rainbowFill = 0; // 0..1
let rainbows = 0; // completed this run, counted indefinitely
const ARC_TIME = 2; // seconds the sweep animation plays for
let arcTime = 0; // seconds left in the sweep, 0 = idle

export function addCoins(x: number, y: number) {
  coins += COIN_VALUE;
  pops.push({ x, y, t: POP_TIME });
  rainbowFill += 1 / FLOWERS_PER_RAINBOW;
  if (rainbowFill >= 1) {
    rainbowFill = 0;
    rainbows++;
    arcTime = ARC_TIME;
  }
}

export function getCoins(): number {
  return coins;
}

export function spendCoins(n: number) {
  coins = Math.max(0, coins - n);
}

export function updateHud(dt: number) {
  for (let i = pops.length - 1; i >= 0; i--) {
    pops[i].t -= dt;
    if (pops[i].t <= 0) {
      pops.splice(i, 1);
    }
  }
  arcTime = Math.max(0, arcTime - dt);
}

// Seven bands, one per rainbow colour — shared by the meter fill and the sweep.
const HUES = [0, 45, 90, 135, 200, 260, 300];

function rainbowGradient(x0: number, x1: number) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  HUES.forEach((h, i) => {
    g.addColorStop(i / (HUES.length - 1), `hsl(${h},90%,60%)`);
  });
  return g;
}

const METER_X = 112;
const METER_W = 168;
const METER_H = 14;

function drawMeter() {
  ctx.fillStyle = "#0006";
  ctx.beginPath();
  ctx.roundRect(METER_X, 13, METER_W, METER_H, 7);
  ctx.fill();
  const fillW = METER_W * rainbowFill;
  if (fillW > 0) {
    ctx.fillStyle = rainbowGradient(METER_X, METER_X + METER_W);
    ctx.beginPath();
    ctx.roundRect(METER_X, 13, fillW, METER_H, 7);
    ctx.fill();
  }
  ctx.textAlign = "left";
  ctx.font = "bold 16px sans-serif";
  ctx.fillStyle = "#ffd54a";
  ctx.fillText(`\u{1F308} ${rainbows}`, METER_X + METER_W + 8, 26);
}

// Broad rainbow arch swept across the garden when the meter fills — centred
// below the playfield so only its top rides into view, like a real rainbow.
function drawRainbowArc() {
  if (arcTime <= 0) {
    return;
  }
  const k = 1 - arcTime / ARC_TIME;
  // capped so bands read as translucent even at full reveal
  const ALPHA = 0.5;
  const cx = VIEW_W / 2;
  const cy = FIELD_BOTTOM - 120;
  // 60% of a half circle, centred on straight up so it reads as an arch, not a horizon-to-horizon rainbow
  const span = Math.PI * 0.6;
  const leftEdge = Math.PI * 1.5 - span / 2;
  const rightEdge = leftEdge + span;
  // Same left-to-right motion for both halves of the animation: draws in by
  // growing the end angle, holds fully drawn, then leaves by growing the
  // start angle over the same span instead of fading — an erase, not a fade.
  // The hold is deliberately shorter than the draw/erase halves.
  const DRAW_FRAC = 0.4;
  const HOLD_FRAC = 0.2;
  const ERASE_FRAC = 1 - DRAW_FRAC - HOLD_FRAC;
  let startAngle = leftEdge;
  let endAngle = leftEdge;
  if (k < DRAW_FRAC) {
    endAngle = leftEdge + span * (k / DRAW_FRAC);
  } else if (k < DRAW_FRAC + HOLD_FRAC) {
    endAngle = rightEdge;
  } else {
    startAngle = leftEdge + span * ((k - DRAW_FRAC - HOLD_FRAC) / ERASE_FRAC);
    endAngle = rightEdge;
  }
  // stretched wide enough that even the innermost (smallest) band's ends
  // land off-screen on both sides
  const RADIUS_X_SCALE = 2.2;
  // taller dome: stretches the peak higher above cy for the same radius
  const RADIUS_Y_SCALE = 1.4;
  const LINE_WIDTH = 16;
  // a stroke covers r ± LINE_WIDTH/2, so equal to LINE_WIDTH is the exact
  // step where neighboring bands touch with no gap and no overlap
  const BAND_STEP = LINE_WIDTH;
  ctx.lineWidth = LINE_WIDTH;
  // Bands are true concentric circles, stretched by one shared transform
  // instead of each drawn as its own ellipse. A circle's outward normal
  // points straight along its radius, so stacking circles by radius is a
  // real parallel offset — their start/end cut edges line up exactly. An
  // ellipse's normal is *not* radial, so the same trick with per-band
  // ellipses left each band's cut edge parallel but shifted sideways from
  // its neighbors, a ragged staircase instead of one clean edge. A single
  // affine transform preserves straight lines, so the aligned edges stay
  // aligned after the stretch.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(RADIUS_X_SCALE, RADIUS_Y_SCALE);
  HUES.forEach((h, i) => {
    const r = 260 - i * BAND_STEP;
    ctx.strokeStyle = `hsla(${h},90%,60%,${ALPHA})`;
    ctx.beginPath();
    ctx.arc(0, 0, r, startAngle, endAngle);
    ctx.stroke();
  });
  ctx.restore();
}

export function drawHud() {
  drawRainbowArc();
  ctx.textAlign = "left";
  ctx.font = "bold 16px sans-serif";
  ctx.fillStyle = "#ffd54a";
  ctx.fillText(`\u{1F4B0} ${coins}`, 10, 26);
  drawMeter();

  ctx.textAlign = "center";
  ctx.font = "bold 13px sans-serif";
  for (const p of pops) {
    const k = p.t / POP_TIME;
    const y = p.y - 18 * (1 - k);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(0,0,0,${0.6 * k})`;
    ctx.strokeText(`+${COIN_VALUE}`, p.x, y);
    ctx.fillStyle = `rgba(255,213,74,${k})`;
    ctx.fillText(`+${COIN_VALUE}`, p.x, y);
  }
}
