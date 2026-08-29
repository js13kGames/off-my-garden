import "./style.css";
import {
  applyViewTransform,
  canvas,
  ctx,
  toLogical,
  VIEW_H,
  VIEW_W,
} from "./canvas";
import {
  drawGarden,
  FIELD_BOTTOM,
  FIELD_TOP,
  sellAt,
  updateGarden,
} from "./garden";
import { addCoins, drawHud, updateHud } from "./hud";
import { drawLep, lep, sendLepTo, updateLep } from "./leprechaun";
import { start } from "./loop";
import { drawNoise, isRingBusy, startRing, updateNoise } from "./noise";
import {
  drawToolbar,
  setBusy,
  takePending,
  toolbarKey,
  toolbarTap,
} from "./toolbar";
import { drawUnicorns, scareUnicorns, updateUnicorns } from "./unicorn";

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
  if (e.key >= "1" && e.key <= "3") {
    toolbarKey(Number(e.key));
  }
});
canvas.addEventListener("pointerdown", (e) => {
  if (state === State.Idle) {
    state = State.Playing;
    return;
  }
  const p = toLogical(e);
  const tool = toolbarTap(p.x, p.y);
  if (tool === 0) {
    // Noise: fired immediately by toolbarTap — apply effect
    lep.moving = false;
    scareUnicorns(lep.x, lep.y);
    startRing();
    setBusy(true);
    return;
  }
  if (tool >= 0) {
    return; // other tools consumed — effects in later tickets
  }
  const f = sellAt(p.x, p.y, lep.x, lep.y);
  if (f) {
    addCoins(f.x, f.y);
    return; // sell taps are consumed — he stays where he is
  }
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
    updateUnicorns(dt);
    updateNoise(dt);
    if (!isRingBusy()) {
      setBusy(false);
    }
    const kb = takePending();
    if (kb === 0) {
      lep.moving = false;
      scareUnicorns(lep.x, lep.y);
      startRing();
      setBusy(true);
    }
    updateHud(dt);
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
    drawUnicorns(time);
    drawNoise();
    drawLep(time);
    drawHud();
    drawToolbar();
    ctx.restore();
  },
);
