import { ctx, VIEW_W } from "./canvas";
import { FIELD_BOTTOM } from "./garden";
import { getCoins, PRICES, spendCoins } from "./hud";

// Tool indices: 0=noise, 1=repel, 2=attract. Const enum erased; kept as
// comments so the mapping is visible in source.
const TOOLS = [
  { icon: "\u{1F50A}" }, // 🔊 noise
  { icon: "\u2618\uFE0F" }, // ☘️ repel
  { icon: "\u{1F48E}" }, // 💎 attract
];

let busy = false;

export function setBusy(b: boolean) {
  busy = b;
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
 * Tap routing for the toolbar strip. Returns the tool index when an
 * affordable button is tapped (spends its price), or -1 for misses, tools
 * the player can't afford, or when another tool is busy.
 */
export function toolbarTap(x: number, y: number): number {
  if (y < BTN_Y || y > BTN_Y + BTN_H) {
    return -1;
  }
  for (let i = 0; i < TOOLS.length; i++) {
    const bx = btnX(i);
    if (x >= bx && x <= bx + BTN_W) {
      if (busy || getCoins() < PRICES[i]) {
        return -1;
      }
      spendCoins(PRICES[i]);
      return i;
    }
  }
  return -1;
}

/** Keyboard shortcut: digit is 1-based (1/2/3), anything else ignored. */
export function toolbarKey(digit: number) {
  const i = digit - 1;
  if (digit >= 1 && digit <= TOOLS.length && !busy && getCoins() >= PRICES[i]) {
    spendCoins(PRICES[i]);
    pending = i;
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
    const afford = getCoins() >= PRICES[i];
    // button plate
    ctx.fillStyle = afford ? "#2a4a73" : "#16283f";
    ctx.beginPath();
    ctx.roundRect(x, BTN_Y, BTN_W, BTN_H, 8);
    ctx.fill();
    ctx.globalAlpha = afford ? 1 : 0.4;
    // icon on the left half, price on the right
    ctx.font = "20px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(TOOLS[i].icon, x + BTN_W / 2 - 24, BTN_Y + BTN_H / 2);
    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = "#ffd54a";
    ctx.fillText(
      `${PRICES[i]}\u{1F4B0}`,
      x + BTN_W / 2 + 20,
      BTN_Y + BTN_H / 2,
    );
    ctx.globalAlpha = 1;
  }
  // drawHud assumes the default baseline on the next frame
  ctx.textBaseline = "alphabetic";
}
