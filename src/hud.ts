import { ctx, VIEW_W } from "./canvas";
import { FIELD_BOTTOM } from "./garden";
import { musicOn, Sfx, sfx, toggleMusic } from "./music";

// Coins earned by selling flowers; spent on tools the moment they're used.
// Per-use price, paid straight from the coin bank; balance against COIN_VALUE in hud.ts.
export const PRICES = [10, 15, 20];
let coins = PRICES[0] + PRICES[1];
const COIN_VALUE = 5;

type Popup = { x: number; y: number; t: number };
const POP_TIME = 0.9;
const pops: Popup[] = [];

// Rainbow objective: every harvested flower fills the meter; a full meter
// draws the rainbow in and wins the run. Coins still count as score, but the
// meter itself never resets once won.
const FLOWERS_PER_RAINBOW = 10;
let rainbowFill = 0; // 0..1
const ARC_TIME = 2; // seconds the draw-in animation takes
let arcT = -1; // seconds since the rainbow was won, -1 = not yet won

export function addCoins(x: number, y: number) {
  coins += COIN_VALUE;
  pops.push({ x, y, t: POP_TIME });
  sfx(Sfx.Coin);
  if (arcT >= 0) {
    return; // already won — meter stays full, no more fills
  }
  rainbowFill += 1 / FLOWERS_PER_RAINBOW;
  if (rainbowFill >= 1) {
    rainbowFill = 1;
    arcT = 0;
  }
}

export function rainbowDone(): boolean {
  return arcT >= 0;
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
  if (arcT >= 0) {
    arcT += dt;
  }
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
}

// Music toggle button, right of the meter in the top HUD strip.
const MUSIC_X = 292;
const MUSIC_Y = 6;
const MUSIC_W = 56;
const MUSIC_H = 28;

/** Bounds-checks a tap against the music button; toggles and reports a hit. */
export function musicButtonTap(x: number, y: number): boolean {
  if (
    x < MUSIC_X ||
    x > MUSIC_X + MUSIC_W ||
    y < MUSIC_Y ||
    y > MUSIC_Y + MUSIC_H
  ) {
    return false;
  }
  toggleMusic();
  return true;
}

function drawMusicButton() {
  ctx.fillStyle = "#2a4a73";
  ctx.beginPath();
  ctx.roundRect(MUSIC_X, MUSIC_Y, MUSIC_W, MUSIC_H, 6);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = MUSIC_X + MUSIC_W / 2;
  ctx.fillStyle = "#fff";
  ctx.font = "bold 9px sans-serif";
  ctx.fillText("MUSIC", cx, MUSIC_Y + 10);
  // only the on/off state dims — the label stays put
  ctx.globalAlpha = musicOn() ? 1 : 0.4;
  ctx.fillStyle = "#ffd54a";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText(musicOn() ? "ON" : "OFF", cx, MUSIC_Y + 21);
  ctx.globalAlpha = 1;
  ctx.textBaseline = "alphabetic";
}

// Broad rainbow arch drawn in once the meter fills, then held on screen for
// the rest of the run — centred below the playfield so only its top rides
// into view, like a real rainbow.
function drawRainbowArc() {
  if (arcT < 0) {
    return;
  }
  const k = Math.min(1, arcT / ARC_TIME);
  // capped so bands read as translucent even at full reveal
  const ALPHA = 0.5;
  const cx = VIEW_W / 2;
  const cy = FIELD_BOTTOM - 120;
  // 60% of a half circle, centred on straight up so it reads as an arch, not a horizon-to-horizon rainbow
  const span = Math.PI * 0.6;
  const leftEdge = Math.PI * 1.5 - span / 2;
  // Draws in left-to-right by growing the end angle, then holds fully drawn
  // — once won, the rainbow stays.
  const startAngle = leftEdge;
  const endAngle = leftEdge + span * k;
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
  drawMusicButton();

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
