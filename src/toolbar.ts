import { ctx, VIEW_W } from "./canvas";
import { FIELD_BOTTOM } from "./garden";
import { getCoins, PRICES, spendCoins } from "./hud";

const TOOLS = [
  { icon: "\u{1F50A}", label: "Noise", left: 5 }, // 🔊 noise
  { icon: "\u2618\uFE0F", label: "Repel", left: 5 }, // ☘️ repel
  { icon: "\u{1F48E}", label: "Attract", left: 2 }, // 💎 attract
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
    // tool icon on the left; bag + price on top right, the word under them
    const textX = x + 42;
    ctx.font = "24px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(TOOLS[i].icon, x + 22, BTN_Y + BTN_H / 2);
    ctx.textAlign = "left";
    ctx.font = "14px sans-serif";
    ctx.fillText("\u{1F4B0}", textX, BTN_Y + 15);
    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = "#ffd54a";
    ctx.fillText(`${PRICES[i]}`, textX + 18, BTN_Y + 15);
    ctx.font = "10px sans-serif";
    ctx.fillStyle = "#cfe0f5";
    ctx.fillText(TOOLS[i].label, textX + TOOLS[i].left, BTN_Y + 32);
    ctx.textAlign = "center";
    ctx.globalAlpha = 1;
  }
  // drawHud assumes the default baseline on the next frame
  ctx.textBaseline = "alphabetic";
}
