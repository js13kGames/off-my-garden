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
  drawCanopy,
  drawGarden,
  drawLawn,
  FIELD_BOTTOM,
  FIELD_TOP,
  gardenStumped,
  harvestAtPosition,
  sellAt,
  updateGarden,
} from "./garden";
import {
  addCoins,
  drawHud,
  getCoins,
  musicButtonTap,
  rainbowArcFinished,
  rainbowDone,
  updateHud,
} from "./hud";
import { drawLep, lep, sendLepTo, updateLep } from "./leprechaun";
import { start } from "./loop";
import { setTrack, startMusic, Track, toggleMusic, updateMusic } from "./music";
import { drawNoise, isRingBusy, startRing, updateNoise } from "./noise";
import {
  drawPlaceables,
  placeAttractor,
  placeRepellent,
  updatePlaceables,
} from "./placeable";
import { drawRain, updateRain } from "./rain";
import {
  drawToolbar,
  setBusy,
  takePending,
  toolbarKey,
  toolbarTap,
} from "./toolbar";
import { drawUnicorns, updateUnicorns } from "./unicorn";
import { updateWaves, wavesSurvived } from "./wave";

// const enum erases to numbers — State.Playing becomes 1 in the bundle
const enum State {
  Idle,
  Playing,
  Won, // rainbow complete — sim frozen, input ignored
  Lost, // every flower stumped — sim frozen, rain falls, tap restarts
}
let state: State = State.Idle;
let time = 0;

// Tools all work the same way: the button fires them where the leprechaun
// stands, so placing him is the whole decision. The toolbar has already spent
// the coins by the time this runs.
function useTool(tool: number) {
  lep.moving = false; // he stops where he is to use it
  if (tool === 0) {
    // Scaring is driven by the ring sweep in noise.ts: unis are hit as the
    // drawn circle reaches them, not all at once.
    startRing();
    setBusy(true);
  } else if (tool === 1) {
    placeRepellent(lep.x, lep.y);
  } else if (tool === 2) {
    placeAttractor(lep.x, lep.y);
  }
}

addEventListener("keydown", (e) => {
  if (e.code === "Space" && state === State.Idle) {
    startMusic();
    state = State.Playing;
  }
  if (e.key === "m" || e.key === "M") {
    toggleMusic();
  }
  if (e.key >= "1" && e.key <= "3" && state === State.Playing) {
    toolbarKey(Number(e.key));
  }
});
canvas.addEventListener("pointerdown", (e) => {
  startMusic();
  const p = toLogical(e);
  if (musicButtonTap(p.x, p.y)) {
    return;
  }
  if (state === State.Won) {
    if (rainbowArcFinished()) {
      location.reload();
    }
    return; // ignore taps mid-reveal so the win can't be dismissed early
  }
  if (state === State.Lost) {
    // ponytail: reload is the reset — swap for in-place resets if the flash
    // shows or a score needs to survive the restart.
    location.reload();
    return;
  }
  if (state === State.Idle) {
    state = State.Playing;
    return;
  }
  const tool = toolbarTap(p.x, p.y);
  if (tool >= 0) {
    useTool(tool);
    return;
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
    updateMusic();
    if (state === State.Won) {
      updateHud(dt); // keeps the arc's draw-in animation playing
      return;
    }
    if (state === State.Lost) {
      updateRain(dt); // keeps the storm ramping/falling
      updateHud(dt); // lets any in-flight coin pop finish fading
      return;
    }
    if (state !== State.Playing) {
      return;
    }
    time += dt;
    updateGarden(dt);
    const wasWalking = lep.moving;
    updateLep(dt);
    const f = wasWalking && harvestAtPosition(lep.x, lep.y);
    if (f) {
      addCoins(f.x, f.y);
    }
    updateWaves(dt);
    updateUnicorns(dt);
    updateNoise(dt);
    updatePlaceables(dt);
    if (!isRingBusy()) {
      setBusy(false);
    }
    const kb = takePending();
    if (kb >= 0) {
      useTool(kb);
    }
    updateHud(dt);
    if (rainbowDone()) {
      state = State.Won; // sim freezes from the next tick on
      setTrack(Track.Win);
    } else if (gardenStumped()) {
      state = State.Lost; // sim freezes, rain takes over from the next tick
      setTrack(Track.Lose);
    }
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
    drawLawn();
    drawGarden(time);
    drawPlaceables(time);
    drawUnicorns(time);
    drawNoise();
    drawLep(time);
    drawCanopy(); // trees overhang everything on the ground
    if (state === State.Lost) {
      drawRain();
    }
    // HUD and toolbar strips. Painted here rather than under the playfield: the
    // canopy's crowns overhang the field edges, and these strips are what crops
    // them back to it.
    ctx.fillStyle = "#1d3557";
    ctx.fillRect(0, 0, VIEW_W, FIELD_TOP);
    ctx.fillRect(0, FIELD_BOTTOM, VIEW_W, VIEW_H - FIELD_BOTTOM);
    drawHud();
    drawToolbar();
    if (state === State.Idle) {
      drawTitleCard();
    } else if (state === State.Won) {
      drawEndCard(true);
    } else if (state === State.Lost) {
      drawEndCard(false);
    }
    ctx.restore();
  },
);

/** Centred rounded panel shared by the title and end cards; returns its top y. */
function drawCard(w: number, h: number): number {
  const x = (VIEW_W - w) / 2;
  const y = (VIEW_H - h) / 2;
  ctx.fillStyle = "rgba(10,15,30,0.85)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.textAlign = "center";
  return y;
}

function drawTitleCard() {
  const y = drawCard(280, 200);
  ctx.fillStyle = "#7cffb0";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("OFF MY LAWN!", VIEW_W / 2, y + 38);
  ctx.fillStyle = "#fff";
  ctx.font = "14px sans-serif";
  ctx.fillText("Keep the unicorns off it.", VIEW_W / 2, y + 62);
  // Emoji-led one-liners: threat, action, goal — the whole loop in three reads.
  ctx.textAlign = "left";
  ctx.font = "13px sans-serif";
  const lines = [
    "\u{1F984}  They stomp your flowers",
    "\u{1F338}  Tap a bloom to harvest it",
    "\u{1F308}  Harvest enough for a rainbow",
  ];
  lines.forEach((line, i) => {
    ctx.fillText(line, (VIEW_W - 280) / 2 + 22, y + 98 + i * 26);
  });
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd54a";
  ctx.font = "13px sans-serif";
  ctx.fillText("tap to start", VIEW_W / 2, y + 180);
}

function drawEndCard(won: boolean) {
  const y = drawCard(220, 120);
  ctx.fillStyle = won ? "#7cffb0" : "#ff6b6b";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(won ? "YOU WIN!" : "GAME OVER", VIEW_W / 2, y + 32);
  ctx.fillStyle = "#fff";
  ctx.font = "15px sans-serif";
  ctx.fillText(`Waves survived: ${wavesSurvived()}`, VIEW_W / 2, y + 60);
  ctx.fillText(`Coins earned: ${getCoins()}`, VIEW_W / 2, y + 82);
  ctx.fillStyle = "#ffd54a";
  ctx.font = "13px sans-serif";
  ctx.fillText("tap to restart", VIEW_W / 2, y + 106);
}
