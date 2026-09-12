import { ctx, VIEW_W } from "./canvas";
import { FIELD_BOTTOM } from "./garden";
import { musicOn, Sfx, sfx, toggleMusic } from "./music";

// Coins earned by selling flowers; spent on tools the moment they're used.
// Per-use price, paid straight from the coin bank; balance against COIN_VALUE in hud.ts.
// Priced against a wave's realistic take (~10-14 harvests at 5-15 coins each,
// so ~90-120 coins): roughly three or four tool uses a wave, not a dozen.
// Cheapest is the noisemaker — it already pays a second cost in the walk over
// there; the attractor is dearest because one placement reshapes traffic for
// the rest of the wave.
// The water bottle is the outlier: it buys growth rather than safety, so it's
// cheap enough to use several times a wave.
export const PRICES = [30, 40, 50, 10];
let coins = PRICES[0] + PRICES[1];
const COIN_VALUE = 5;

type Popup = { x: number; y: number; t: number; gain: number; hue: number };
const POP_TIME = 0.9;
const pops: Popup[] = [];

// Rainbow objective: every harvested flower adds points to the meter; a full
// meter draws the rainbow in and wins the run. Coins still count as score, but
// the meter itself never resets once won.
// Points, not flowers: a plain harvest is worth 1, so a rainbow is 30 lone
// blooms — slow enough that the run breathes — but chaining same-coloured
// harvests pays up to 3 a pop, which is how a good player actually gets there.
const POINTS_PER_RAINBOW = 30;
const COMBO_CAP = 3;
// Whole points, not a 0..1 fraction: summing gain/30 fractions drifts below 1
// (30 lone blooms used to land on 0.9999999999999999 and never win), so the
// threshold compares integers and the meter divides only for drawing.
let rainbowPoints = 0;
const ARC_TIME = 2; // seconds the draw-in animation takes
let arcT = -1; // seconds since the rainbow was won, -1 = not yet won
let comboHue = -1; // hue of the last harvest, -1 = no chain running
let combo = 0; // how many same-hue harvests in a row, including this one

// `practice` = harvested during the tutorial: it still pays coins and pops,
// because that is what the rewards lesson is teaching, but it must not fill
// the meter. The tutorial garden is never reset by a wave, so its 21 flowers
// are enough to complete a rainbow and draw the arc in behind the lessons.
export function addCoins(
  f: { x: number; y: number; hue: number },
  practice = false,
) {
  sfx(Sfx.Coin);
  combo = f.hue === comboHue ? combo + 1 : 1;
  comboHue = f.hue;
  // One multiplier for both rewards: a chained harvest pays the same factor
  // in coins as it does in meter points.
  const gain = Math.min(combo, COMBO_CAP);
  coins += COIN_VALUE * gain;
  pops.push({ x: f.x, y: f.y, t: POP_TIME, gain, hue: f.hue });
  if (practice || arcT >= 0) {
    return; // tutorial, or already won — meter stays as it is
  }
  rainbowPoints += gain;
  if (rainbowPoints >= POINTS_PER_RAINBOW) {
    arcT = 0;
  }
}

export function rainbowDone(): boolean {
  return arcT >= 0;
}

// True once the draw-in animation has fully played, not just started —
// gates the "tap to restart" so a win can't be dismissed mid-reveal.
export function rainbowArcFinished(): boolean {
  return arcT >= ARC_TIME;
}

// Sparkles scattered across the arch's span, fixed once so they don't jitter
// frame to frame — each twinkles on its own phase/speed via a sine wave.
const SPARKLE_COUNT = 24;
const sparkles = Array.from({ length: SPARKLE_COUNT }, () => ({
  a: Math.random(), // 0..1 across the arc's angular span
  r: 130 + Math.random() * 220, // spans the band stack (~164-260) and spills over/under it
  phase: Math.random() * Math.PI * 2,
  speed: 2 + Math.random() * 2,
}));

export function getCoins(): number {
  return coins;
}

// Back to a fresh run's state — the tutorial restore uses this so practice
// harvests can't carry coins or rainbow progress into real play.
export function resetHud() {
  coins = PRICES[0] + PRICES[1];
  rainbowPoints = 0;
  arcT = -1;
  combo = 0;
  comboHue = -1;
  pops.length = 0;
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
const HUES = [0, 30, 60, 120, 240, 275, 300];

function rainbowGradient(x0: number, x1: number) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  HUES.forEach((h, i) => {
    g.addColorStop(i / (HUES.length - 1), `hsl(${h},90%,60%)`);
  });
  return g;
}

// Meter sits between the coin count and the two HUD buttons — narrowed and
// pulled left when the reset button joined the music toggle on the right.
// Left edge clears a four-digit coin count at 16px (the count realistically
// tops out at three), and the width runs it up to the buttons.
const METER_X = 72;
const METER_W = 164;
const METER_H = 14;

function drawMeter() {
  ctx.fillStyle = "#0006";
  ctx.beginPath();
  ctx.roundRect(METER_X, 13, METER_W, METER_H, 7);
  ctx.fill();
  const fillW = METER_W * Math.min(1, rainbowPoints / POINTS_PER_RAINBOW);
  if (fillW > 0) {
    ctx.fillStyle = rainbowGradient(METER_X, METER_X + METER_W);
    ctx.beginPath();
    ctx.roundRect(METER_X, 13, fillW, METER_H, 7);
    ctx.fill();
  }
}

// The two HUD buttons, right of the meter in the top strip: music toggle, then
// reset. Same row, so only the x differs.
const BTN_Y = 6;
const BTN_W = 48;
const BTN_H = 28;
const MUSIC_X = 246;
const RESET_X = 302;

const hitButton = (bx: number, x: number, y: number) =>
  x >= bx && x <= bx + BTN_W && y >= BTN_Y && y <= BTN_Y + BTN_H;

/** Bounds-checks a tap against the music button; toggles and reports a hit. */
export function musicButtonTap(x: number, y: number): boolean {
  if (!hitButton(MUSIC_X, x, y)) {
    return false;
  }
  toggleMusic();
  return true;
}

/** Bounds-checks a tap against the reset button. The restart itself lives in
 * main.ts, which owns the run state. */
export const resetButtonTap = (x: number, y: number) =>
  hitButton(RESET_X, x, y);

// Two stacked lines: a fixed label over a state line that dims when the button
// is off or unavailable.
function drawButton(bx: number, label: string, value: string, lit: boolean) {
  ctx.fillStyle = "#2a4a73";
  ctx.beginPath();
  ctx.roundRect(bx, BTN_Y, BTN_W, BTN_H, 6);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = bx + BTN_W / 2;
  ctx.fillStyle = "#fff";
  ctx.font = "bold 9px sans-serif";
  ctx.fillText(label, cx, BTN_Y + 10);
  // only the state line dims — the label stays put
  ctx.globalAlpha = lit ? 1 : 0.4;
  ctx.fillStyle = "#ffd54a";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText(value, cx, BTN_Y + 21);
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
  // near-opaque — at 0.5 the green lawn bled through and muddied every band
  const ALPHA = 0.75;
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
  // Twinkling plus-shaped sparkles scattered over the revealed part of the
  // arch, drawn in the same stretched space so they sit flush against the bands.
  for (const s of sparkles) {
    const angle = leftEdge + span * s.a;
    if (angle > endAngle) {
      continue; // not yet drawn in
    }
    const twinkle = 0.5 + 0.5 * Math.sin(arcT * s.speed + s.phase);
    if (twinkle < 0.15) {
      continue; // fully dim — skip the draw
    }
    const px = Math.cos(angle) * s.r;
    const py = Math.sin(angle) * s.r;
    drawSparklePlus(px, py, 10.5, twinkle);
  }
  ctx.restore();
}

// A plus sign whose arms fade to transparent at both ends, drawn as two
// gradient bars rather than a single sprite so the fade is stretch-free.
function drawSparklePlus(px: number, py: number, size: number, alpha: number) {
  const half = size / 2;
  const thickness = size * 0.06;
  const gh = ctx.createLinearGradient(px - half, py, px + half, py);
  gh.addColorStop(0, "rgba(255,255,255,0)");
  gh.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
  gh.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gh;
  ctx.fillRect(px - half, py - thickness / 2, size, thickness);
  const gv = ctx.createLinearGradient(px, py - half, px, py + half);
  gv.addColorStop(0, "rgba(255,255,255,0)");
  gv.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
  gv.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gv;
  ctx.fillRect(px - thickness / 2, py - half, thickness, size);
}

/** `canReset` greys the reset button out when there's no run to abandon. */
export function drawHud(canReset: boolean) {
  drawRainbowArc();
  ctx.textAlign = "left";
  ctx.font = "bold 16px sans-serif";
  ctx.fillStyle = "#ffd54a";
  ctx.fillText(`\u{1F4B0} ${coins}`, 10, 26);
  drawMeter();
  drawButton(MUSIC_X, "MUSIC", musicOn() ? "ON" : "OFF", musicOn());
  drawButton(RESET_X, "RESET", "↺", canReset);

  ctx.textAlign = "center";
  ctx.font = "bold 13px sans-serif";
  for (const p of pops) {
    const k = p.t / POP_TIME;
    const y = p.y - 18 * (1 - k);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(0,0,0,${0.6 * k})`;
    const paid = `+${COIN_VALUE * p.gain}`;
    ctx.strokeText(paid, p.x, y);
    ctx.fillStyle = `rgba(255,213,74,${k})`;
    ctx.fillText(paid, p.x, y);
    // Meter gain rides above the coin pop, in the flower's own colour so a
    // chained harvest reads as "that colour again" without extra wording.
    ctx.strokeText(`+${p.gain}`, p.x, y - 14);
    ctx.fillStyle = `hsla(${p.hue},90%,65%,${k})`;
    ctx.fillText(`+${p.gain}`, p.x, y - 14);
  }
}
