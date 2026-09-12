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
  resetGarden,
  sellAt,
  updateGarden,
} from "./garden";
import {
  addCoins,
  drawHud,
  musicButtonTap,
  rainbowArcFinished,
  rainbowDone,
  resetButtonTap,
  resetHud,
  updateHud,
} from "./hud";
import { drawLep, LEP_START, lep, sendLepTo, updateLep } from "./leprechaun";
import { start } from "./loop";
import { setTrack, startMusic, Track, updateMusic } from "./music";
import { drawNoise, isRingBusy, startRing, updateNoise } from "./noise";
import {
  attractors,
  drawPlaceables,
  placeAttractor,
  placeRepellent,
  repellents,
  updatePlaceables,
} from "./placeable";
import { drawRain, resetRain, updateRain } from "./rain";
import {
  drawToolbar,
  setBusy,
  setToolGate,
  TOOL_ALL,
  toolbarTap,
} from "./toolbar";
import {
  begin,
  completeTutorial,
  draw as drawTutorialPanel,
  flowersShown,
  harvested,
  harvestingOn,
  isFinished,
  moved,
  toolUsed,
  tutorialCompleted,
  tap as tutorialTap,
  update as tutorialUpdate,
} from "./tutorial";
import { drawUnicorns, unicorns, updateUnicorns } from "./unicorn";
import { resetWaves, unicornsSeen, updateWaves } from "./wave";

// const enum erases to numbers — State.Playing becomes 1 in the bundle
const enum State {
  Idle,
  Tutorial, // guided first run — practice garden, no unicorns, no win/loss
  Playing,
  Won, // rainbow complete — sim frozen, input ignored
  Lost, // too many flowers stumped — sim frozen, rain falls, tap restarts
}
let state: State = State.Idle;
let time = 0;
// Seconds the loss card has been up. The win card gates its restart on the
// rainbow reveal; the loss card has no animation to wait for, so it holds a
// fixed beat instead — long enough that the tap that lost the run can't
// bounce straight off the card.
const LOSS_HOLD = 2;
let lostFor = 0;

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
  } else if (tool === 3) {
    // Same sweeping ring as the noisemaker, boosting flowers instead of
    // scaring unis — see startRing's `water` flag.
    startRing(true);
    setBusy(true);
  }
}

// Shared entry for the pointer and keyboard starts. The first play goes
// through the tutorial; once it's completed, runs start straight in the
// garden. The Tutorial button always replays the lesson.
function startRun(fromTutorialButton: boolean) {
  startMusic();
  if (fromTutorialButton || !tutorialCompleted()) {
    begin();
    state = State.Tutorial;
  } else {
    state = State.Playing;
  }
}

// Puts every system back to its fresh-run state. The page never reloads — the
// game runs in an iframe — so this is the one restart path: the tutorial
// handoff and both end cards go through it.
function resetRun() {
  updateNoise(1); // finish any in-flight ring, or it resumes over the new run
  resetGarden();
  unicorns.length = 0; // a leftover uni would trample the fresh garden uncounted
  resetWaves();
  repellents.length = 0;
  attractors.length = 0;
  resetRain();
  lep.x = lep.tx = LEP_START.x;
  lep.y = lep.ty = LEP_START.y;
  lep.moving = false;
  lep.blocking = false;
  resetHud();
  setBusy(false);
  setToolGate(TOOL_ALL);
  time = 0;
  lostFor = 0;
  variant = (Math.random() * 3) | 0; // fresh end-card wording per run
  setTrack(Track.Play);
}

// Practice is over: normal play starts from the same conditions as a
// non-tutorial run.
function finishTutorial() {
  completeTutorial();
  resetRun();
  state = State.Playing;
}

canvas.addEventListener("pointerdown", (e) => {
  startMusic();
  const p = toLogical(e);
  if (musicButtonTap(p.x, p.y)) {
    return;
  }
  // Abandons the run from anywhere but the title card, where there's nothing
  // to abandon. Checked before the state branches so it beats the end cards'
  // tap-anywhere restart to the punch — same outcome either way.
  if (state !== State.Idle && resetButtonTap(p.x, p.y)) {
    resetRun();
    state = State.Idle;
    return;
  }
  if (state === State.Won) {
    if (rainbowArcFinished()) {
      resetRun();
      state = State.Idle;
    }
    return; // ignore taps mid-reveal so the win can't be dismissed early
  }
  if (state === State.Lost) {
    // ignore taps during the hold so a tap aimed at the garden can't skip the card
    if (lostFor >= LOSS_HOLD) {
      resetRun();
      state = State.Idle;
    }
    return;
  }
  if (state === State.Idle) {
    const button = titleButtonTap(p.x, p.y);
    if (button >= 0) {
      startRun(button === 1);
    }
    return;
  }
  if (state === State.Tutorial) {
    // Continue buttons are consumed here so they can't fall through to
    // movement or tool use.
    if (tutorialTap(p.x, p.y)) {
      return;
    }
    const tool = toolbarTap(p.x, p.y);
    if (tool >= 0) {
      useTool(tool);
      toolUsed(tool);
      return;
    }
    // harvesting only unlocks with its lesson; out-of-range or early taps
    // keep their normal movement behaviour
    if (harvestingOn()) {
      const f = sellAt(p.x, p.y, lep.x, lep.y);
      if (f) {
        addCoins(f, true);
        harvested();
        return; // sell taps are consumed — he stays where he is
      }
    }
    if (p.y > FIELD_TOP && p.y < FIELD_BOTTOM) {
      sendLepTo(p.x, p.y);
      moved();
    }
    return;
  }
  const tool = toolbarTap(p.x, p.y);
  if (tool >= 0) {
    useTool(tool);
    return;
  }
  const f = sellAt(p.x, p.y, lep.x, lep.y);
  if (f) {
    addCoins(f);
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
      lostFor += dt;
      updateRain(dt); // keeps the storm ramping/falling
      updateHud(dt); // lets any in-flight coin pop finish fading
      return;
    }
    if (state === State.Tutorial) {
      time += dt;
      tutorialUpdate(dt);
      if (!isRingBusy()) {
        setBusy(false);
      }
      updateHud(dt);
      if (isFinished()) {
        finishTutorial();
      }
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
      addCoins(f);
    }
    updateWaves(dt);
    updateUnicorns(dt);
    updateNoise(dt);
    updatePlaceables(dt);
    if (!isRingBusy()) {
      setBusy(false);
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
    // the movement lesson shows a bare lawn — flowers appear with the
    // growth lesson
    if (state !== State.Tutorial || flowersShown()) {
      drawGarden(time);
    }
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
    drawHud(state !== State.Idle);
    drawToolbar();
    if (state === State.Tutorial) {
      drawTutorialPanel(time); // instruction panel paints over everything
    } else if (state === State.Idle) {
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

// Title card geometry, shared by drawing and hit-testing. Two stacked
// buttons: Play and an always-available Tutorial replay.
const TITLE_CARD_H = 250;
const TITLE_BTN_W = 150;
const TITLE_BTN_H = 32;
const TITLE_BTN_X = (VIEW_W - TITLE_BTN_W) / 2;
const TITLE_PLAY_Y = (VIEW_H - TITLE_CARD_H) / 2 + 168;
const TITLE_TUT_Y = TITLE_PLAY_Y + 40;

/** Returns 0 for Play, 1 for Tutorial, -1 for a miss. */
function titleButtonTap(x: number, y: number): number {
  if (x < TITLE_BTN_X || x > TITLE_BTN_X + TITLE_BTN_W) {
    return -1;
  }
  if (y >= TITLE_PLAY_Y && y <= TITLE_PLAY_Y + TITLE_BTN_H) {
    return 0;
  }
  if (y >= TITLE_TUT_Y && y <= TITLE_TUT_Y + TITLE_BTN_H) {
    return 1;
  }
  return -1;
}

function titleButton(label: string, y: number) {
  ctx.fillStyle = "#2a4a73";
  ctx.beginPath();
  ctx.roundRect(TITLE_BTN_X, y, TITLE_BTN_W, TITLE_BTN_H, 8);
  ctx.fill();
  ctx.fillStyle = "#ffd54a";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText(label, VIEW_W / 2, y + 21);
}

function drawTitleCard() {
  const y = drawCard(280, TITLE_CARD_H);
  ctx.fillStyle = "#7cffb0";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("OFF MY LAWN!", VIEW_W / 2, y + 38);
  ctx.fillStyle = "#fff";
  ctx.font = "14px sans-serif";
  ctx.fillText("Protect the rainbow garden!", VIEW_W / 2, y + 62);
  // Emoji-led one-liners: threat, action, goal — the whole loop in three reads.
  ctx.textAlign = "left";
  ctx.font = "13px sans-serif";
  const lines = [
    "\u{1F984}  Unicorns stomp your flowers",
    "\u{1F338}  Tap a bloom to harvest it",
    "\u{1F308}  Harvest enough for a rainbow",
  ];
  lines.forEach((line, i) => {
    ctx.fillText(line, (VIEW_W - 280) / 2 + 22, y + 98 + i * 26);
  });
  ctx.textAlign = "center";
  titleButton("PLAY", TITLE_PLAY_Y);
  titleButton("TUTORIAL", TITLE_TUT_Y);
}

// Which end-card wording this run gets; re-rolled by resetRun.
let variant = (Math.random() * 3) | 0;

// Hand-split to the card width; three lines each keeps the layout fixed.
const WIN_LINES = (n: number) => [
  [
    `After ${n} unicorns, the garden held!`,
    "Your rainbow is up there",
    "for everyone to see.",
  ],
  [
    `Not one of ${n} unicorns got`,
    "what they came for.",
    "Beautiful rainbow, gardener.",
  ],
  [
    "Petals intact, sky painted.",
    `After ${n} unicorns,`,
    "that rainbow is all yours.",
  ],
];
const LOSS_LINES = (n: number) => [
  [
    "Some gardener you are.",
    `${n} unicorns in, and your`,
    "flowers are mulch.",
  ],
  [
    "The pot of gold stays empty.",
    `${n} unicorns trampled`,
    "the garden flat.",
  ],
  [
    `${n} unicorns later, barely a petal`,
    "left standing. The rainbow",
    "will have to wait.",
  ],
];

function drawEndCard(won: boolean) {
  const n = unicornsSeen();
  const lines = (won ? WIN_LINES(n) : LOSS_LINES(n))[variant];
  const y = drawCard(300, 150);
  ctx.fillStyle = won ? "#7cffb0" : "#ff6b6b";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(won ? "YOU WIN!" : "GAME OVER", VIEW_W / 2, y + 32);
  ctx.fillStyle = "#fff";
  ctx.font = "14px sans-serif";
  lines.forEach((line, i) => {
    ctx.fillText(line, VIEW_W / 2, y + 64 + i * 21);
  });
  // the prompt appears only once the tap actually restarts
  if (won || lostFor >= LOSS_HOLD) {
    ctx.fillStyle = "#ffd54a";
    ctx.font = "13px sans-serif";
    ctx.fillText("tap to restart", VIEW_W / 2, y + 133);
  }
}
