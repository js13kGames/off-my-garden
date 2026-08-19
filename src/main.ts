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
import { drawLep, sendLepTo, updateLep } from "./leprechaun";
import { start } from "./loop";

// const enum erases to numbers — State.Playing becomes 1 in the bundle
const enum State {
  Idle,
  Playing,
}
let state: State = State.Idle;
let time = 0;

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
  const p = toLogical(e);
  // taps on the HUD/toolbar strips don't move him
  if (p.y > FIELD_TOP && p.y < FIELD_BOTTOM) {
    sendLepTo(p.x, p.y);
  }
});

start(
  // update
  ({ dt }) => {
    if (state !== State.Playing) {
      return;
    }
    time += dt;
    updateGarden(dt);
    updateLep(dt);
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
    drawLep(time);
    ctx.restore();
  },
);
