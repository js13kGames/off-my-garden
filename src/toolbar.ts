import { ctx, VIEW_W } from "./canvas";
import { FIELD_BOTTOM } from "./garden";

// Tool indices: 0=noise, 1=repel, 2=attract. Const enum erased; kept as
// comments so the mapping is visible in source.
const TOOLS = [
  { icon: "\u{1F50A}" }, // 🔊 noise
  { icon: "\u2618\uFE0F" }, // ☘️ repel
  { icon: "\u{1F48E}" }, // 💎 attract
];

// Dev stock so tools are testable now; the shop ticket replaces this with
// between-wave purchases.
const stock = [3, 3, 3];

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
