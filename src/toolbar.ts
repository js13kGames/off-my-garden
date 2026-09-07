import { ctx, VIEW_H, VIEW_W } from "./canvas";
import { FIELD_BOTTOM } from "./garden";
import { getCoins, spendCoins } from "./hud";

// Tool indices: 0=noise, 1=repel, 2=attract. Const enum erased; kept as
// comments so the mapping is visible in source.
const TOOLS = [
  { icon: "\u{1F50A}" }, // 🔊 noise
  { icon: "\u2618\uFE0F" }, // ☘️ repel
  { icon: "\u{1F48E}" }, // 💎 attract
];

// Tuning constants for the between-wave shop; balance against COIN_VALUE in hud.ts.
const PRICES = [10, 15, 20];

// Wave 1 has no tools — the leprechaun's presence is the only defense until
// the first shop.
const stock = [0, 0, 0];

let busy = false;

export function setBusy(b: boolean) {
  busy = b;
}

export function isBusy(): boolean {
  return busy;
}

// Buttons sit in the strip below the playfield, evenly spaced with side margins
const BTN_W = 104;
const BTN_H = 44;
const GAP = 12;
const BTN_Y = FIELD_BOTTOM + 8;
const btnX = (i: number) =>
  (VIEW_W - TOOLS.length * BTN_W - (TOOLS.length - 1) * GAP) / 2 +
  i * (BTN_W + GAP);

/**
 * Tap routing for the toolbar strip. Returns the tool index when a button
 * with stock is tapped (consumes one unit), or -1 for misses, empty tools,
 * or when another tool is busy.
 */
export function toolbarTap(x: number, y: number): number {
  if (y < BTN_Y || y > BTN_Y + BTN_H) {
    return -1;
  }
  for (let i = 0; i < TOOLS.length; i++) {
    const bx = btnX(i);
    if (x >= bx && x <= bx + BTN_W) {
      if (busy || stock[i] === 0) {
        return -1;
      }
      stock[i]--;
      return i;
    }
  }
  return -1;
}

/** Keyboard shortcut: digit is 1-based (1/2/3), anything else ignored. */
export function toolbarKey(digit: number) {
  if (digit >= 1 && digit <= TOOLS.length && !busy && stock[digit - 1] > 0) {
    stock[digit - 1]--;
    pending = digit - 1;
  }
}

let pending = -1;
/** Returns the tool fired by keyboard, or -1. Clears the pending state. */
export function takePending(): number {
  const t = pending;
  pending = -1;
  return t;
}

export function drawToolbar() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < TOOLS.length; i++) {
    const x = btnX(i);
    const empty = stock[i] === 0;
    // button plate
    ctx.fillStyle = empty ? "#16283f" : "#2a4a73";
    ctx.beginPath();
    ctx.roundRect(x, BTN_Y, BTN_W, BTN_H, 8);
    ctx.fill();
    ctx.globalAlpha = empty ? 0.4 : 1;
    // icon, nudged left so it clears the corner badge
    ctx.font = "20px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(TOOLS[i].icon, x + BTN_W / 2 - 6, BTN_Y + BTN_H / 2);
    // stock badge
    ctx.fillStyle = empty ? "#777" : "#ffd54a";
    ctx.beginPath();
    ctx.arc(x + BTN_W - 9, BTN_Y + 9, 9, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(String(stock[i]), x + BTN_W - 9, BTN_Y + 10);
    ctx.globalAlpha = 1;
  }
  // drawHud assumes the default baseline on the next frame
  ctx.textBaseline = "alphabetic";
}

// Shop panel geometry, laid out below the coin readout: one row per tool,
// then a start button — reuses the toolbar's plate/badge look.
const SHOP_W = 280;
const SHOP_X = (VIEW_W - SHOP_W) / 2;
const SHOP_Y = 110;
const ROW_X = SHOP_X + 16;
const ROW_W = SHOP_W - 32;
const ROW_H = 48;
const ROW_GAP = 10;
const rowY = (i: number) => SHOP_Y + 55 + i * (ROW_H + ROW_GAP);
const START_Y = rowY(TOOLS.length) + 20;
const START_H = 50;
const SHOP_H = START_Y + START_H + 20 - SHOP_Y;

/** Draws the between-wave shop overlay. `wave` is the upcoming wave number. */
export function drawShop(wave: number) {
  // scrim over the frozen garden
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.fillStyle = "#1d3557";
  ctx.beginPath();
  ctx.roundRect(SHOP_X, SHOP_Y, SHOP_W, SHOP_H, 12);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffd54a";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(`\u{1F4B0} ${getCoins()}`, VIEW_W / 2, SHOP_Y + 28);

  for (let i = 0; i < TOOLS.length; i++) {
    const y = rowY(i);
    const afford = getCoins() >= PRICES[i];
    ctx.fillStyle = afford ? "#2a4a73" : "#16283f";
    ctx.beginPath();
    ctx.roundRect(ROW_X, y, ROW_W, ROW_H, 8);
    ctx.fill();
    ctx.globalAlpha = afford ? 1 : 0.4;

    ctx.textAlign = "left";
    ctx.font = "20px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(TOOLS[i].icon, ROW_X + 14, y + ROW_H / 2);
    ctx.font = "14px sans-serif";
    ctx.fillText(`${PRICES[i]}\u{1F4B0}`, ROW_X + 50, y + ROW_H / 2);

    ctx.textAlign = "right";
    ctx.fillStyle = "#ffd54a";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(`x${stock[i]}`, ROW_X + ROW_W - 14, y + ROW_H / 2);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = "#2e8b57";
  ctx.beginPath();
  ctx.roundRect(ROW_X, START_Y, ROW_W, START_H, 10);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(`START WAVE ${wave}`, VIEW_W / 2, START_Y + START_H / 2);

  // drawHud assumes the default baseline on the next frame
  ctx.textBaseline = "alphabetic";
}

/**
 * Tap routing for the shop overlay. Buying a tool spends coins and repeats
 * (returns false, stays open); tapping the start button returns true.
 */
export function shopTap(x: number, y: number): boolean {
  if (x >= ROW_X && x <= ROW_X + ROW_W) {
    if (y >= START_Y && y <= START_Y + START_H) {
      return true;
    }
    for (let i = 0; i < TOOLS.length; i++) {
      const y0 = rowY(i);
      if (y >= y0 && y <= y0 + ROW_H && getCoins() >= PRICES[i]) {
        spendCoins(PRICES[i]);
        stock[i]++;
        break;
      }
    }
  }
  return false;
}
