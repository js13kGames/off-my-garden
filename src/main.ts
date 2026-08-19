import "./style.css";
import {
  applyViewTransform,
  canvas,
  ctx,
  toLogical,
  VIEW_H,
  VIEW_W,
} from "./canvas";
import { drawGarden, FIELD_BOTTOM, FIELD_TOP, updateGarden } from "./garden";
import { start } from "./loop";

// const enum erases to numbers — State.Playing becomes 1 in the bundle
const enum State {
  Idle,
  Playing,
}
let state: State = State.Idle;
let time = 0;

// ponytail: debug marker for viewport acceptance; replaced by real input handling later
let mark: { x: number; y: number } | undefined;

addEventListener("keydown", (e) => {
  if (e.code === "Space" && state === State.Idle) {
    state = State.Playing;
  }
});
canvas.addEventListener("pointerdown", (e) => {
  if (state === State.Idle) {
    state = State.Playing;
    return;
  }
  mark = toLogical(e);
});

start(
  // update
  ({ dt }) => {
    if (state !== State.Playing) {
      return;
    }
    time += dt;
    updateGarden(dt);
  },
  // render
  () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    applyViewTransform();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_W, VIEW_H);
    ctx.clip();
    // lawn
    ctx.fillStyle = "#7ec850";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // HUD and toolbar strips — filled in by later tickets
    ctx.fillStyle = "#1d3557";
    ctx.fillRect(0, 0, VIEW_W, FIELD_TOP);
    ctx.fillRect(0, FIELD_BOTTOM, VIEW_W, VIEW_H - FIELD_BOTTOM);
    drawGarden(time);
    if (mark) {
      ctx.strokeStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(mark.x - 8, mark.y);
      ctx.lineTo(mark.x + 8, mark.y);
      ctx.moveTo(mark.x, mark.y - 8);
      ctx.lineTo(mark.x, mark.y + 8);
      ctx.stroke();
    }
    ctx.restore();
  },
);
