import { ctx, VIEW_W } from "./canvas";
import { FIELD_BOTTOM } from "./garden";

// module-local: an exported const enum would stop erasing under isolatedModules
const enum Tool {
  Noise,
  Repel,
  Attract,
}

const TOOLS = [
  { icon: "\u{1F50A}" }, // 🔊 noise
  { icon: "\u2618\uFE0F" }, // ☘️ repel
  { icon: "\u{1F308}" }, // 🌈 attract
];

// Dev stock so tools are testable now; the shop ticket replaces this with
// between-wave purchases.
const stock = [3, 3, 3];

let selected: Tool | undefined;

// Buttons sit in the strip below the playfield, evenly spaced with side margins
const BTN_W = 104;
const BTN_H = 44;
const GAP = 12;
const BTN_Y = FIELD_BOTTOM + 8;
const btnX = (i: number) =>
  (VIEW_W - TOOLS.length * BTN_W - (TOOLS.length - 1) * GAP) / 2 +
  i * (BTN_W + GAP);

function toggle(t: Tool) {
  // empty tools reject selection — nothing to spend
  if (stock[t] === 0) {
    return;
  }
  selected = selected === t ? undefined : t;
}

/** Tap routing for the toolbar strip; true when the tap hit a button. */
export function toolbarTap(x: number, y: number): boolean {
  if (y < BTN_Y || y > BTN_Y + BTN_H) {
    return false;
  }
  for (let i = 0; i < TOOLS.length; i++) {
    const bx = btnX(i);
    if (x >= bx && x <= bx + BTN_W) {
      toggle(i);
      return true;
    }
  }
  return false;
}

/** Keyboard shortcut: digit is 1-based (1/2/3), anything else ignored. */
export function toolbarKey(digit: number) {
  if (digit >= 1 && digit <= TOOLS.length) {
    toggle(digit - 1);
  }
}

/**
 * Consumes one unit of stock from the selected tool, clears the selection and
 * reports which tool fired so callers can apply its effect at the tap point.
 * Undefined when no tool is selected.
 */
export function takeTool(): Tool | undefined {
  if (selected === undefined) {
    return undefined;
  }
  const t = selected;
  selected = undefined;
  stock[t]--;
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
    if (selected === i) {
      // simple rectangular highlight around the selected tool
      ctx.strokeStyle = "#ffd54a";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
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
