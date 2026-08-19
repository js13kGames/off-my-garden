import "./style.css";
import { canvas, ctx } from "./canvas";
import { start } from "./loop";

// const enum erases to numbers — State.Playing becomes 1 in the bundle
const enum State {
  Idle,
  Playing,
}
let state: State = State.Idle;

addEventListener("keydown", (e) => {
  if (e.code === "Space" && state === State.Idle) {
    state = State.Playing;
  }
});
canvas.addEventListener("pointerdown", () => {
  if (state === State.Idle) {
    state = State.Playing;
  }
});

start(
  // update
  () => {},
  // render
  () => {
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  },
);
