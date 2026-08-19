import "./style.css";
import {
  applyViewTransform,
  canvas,
  ctx,
  toLogical,
  VIEW_H,
  VIEW_W,
} from "./canvas";
import { start } from "./loop";

// const enum erases to numbers — State.Playing becomes 1 in the bundle
const enum State {
  Idle,
  Playing,
}
let state: State = State.Idle;

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
  () => {},
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
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
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
