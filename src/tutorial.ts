import { ctx, VIEW_H, VIEW_W } from "./canvas";
import {
  beds,
  FIELD_BOTTOM,
  FIELD_TOP,
  type Flower,
  harvestAtPosition,
  resetGarden,
  STAGE_BLOOM,
  updateGarden,
} from "./garden";
import { addCoins } from "./hud";
import { lep, updateLep } from "./leprechaun";
import { isRingBusy, updateNoise } from "./noise";
import { setToolGate, TOOL_NONE, toolButtonCenter } from "./toolbar";
import { isScared, spawnUnicorn, unicorns, updateUnicorns } from "./unicorn";

// module-local: an exported const enum would stop erasing under isolatedModules
// One entry per panel — the lessons that used to hold two panels (rewards,
// tools) are two steps, so there is no sub-phase to track anywhere.
const enum Step {
  Move,
  Grow,
  Harvest,
  Coins,
  Rainbow,
  Threat,
  Noise,
  Tools,
  Danger, // the losing condition, on its own so it doesn't ride along with a tip
  Ready,
}

// Panel text, indexed by step. Newlines are the line breaks, kept by hand so
// the wrapping is the same on every device.
const LESSONS = [
  "Tap the screen to move.",
  "Flowers grow over time.\nBlooms are ready to be picked.",
  "Collect flowers by tapping or\nwalking through them.\nMove close before tapping a bloom.",
  "Flowers earn coins for tools.\nSame colour in a row pays more.",
  "Fill the rainbow to win!",
  "Unicorns trample your flowers.\nMove near unicorns to push them away.\nTry it now.",
  "Tap noise to send them back.\nUse when close to a unicorn.\nTry it!",
  "Repel protects a patch.\nAttract lures unicorns away.\nWater makes flowers grow faster.",
  // the one lesson about losing — kept on its own panel so it isn't read as
  // another tip. Wording tracks gardenStumped()'s "most of what's left".
  "Careful: if unicorns trample most\nof the garden, it's game over.\nRain gathers when ruin is close.\nPicked flowers are safe: harvest early!",
  "Harvest flowers,  complete your rainbow.\nFresh flowers grow each season.",
];

// Steps that wait for a click to continue; the rest advance on a real action
// (a move, a harvest, a push, a noise ring landing).
const HINT_STEPS = [Step.Coins, Step.Rainbow, Step.Tools, Step.Danger];

// Seconds between a lesson's trigger and its panel showing — the world reacts
// first, the explanation follows a beat later. 0 where the new panel must read
// as the same beat as the one before it, and on harvest so its just-blooming
// flower can still be collected while the panel is up.
const REVEAL = [0, 1, 0, 0.5, 0, 1, 1, 0, 0.5, 0.5];

// The growth lesson runs the garden clock 5x so the demonstration flowers
// reach the pre-bloom stage in ~2.5 s instead of the ~13 s a real season takes.
const GROWTH_ACCEL = 5;
// Fixed entry for the practice unicorn — the bottom-left corner, so the lesson
// starts the same way every run and the uni walks up across the lawn.
const PRACTICE_ENTRY = { x: -30, y: FIELD_BOTTOM - 40 };

// Completion persists as a bare flag — the only question ever asked is "has
// the tutorial been finished", so the value is just "1".
const STORAGE_KEY = "off-my-lawn:tutorial-completed";

let completed = false;
try {
  completed = localStorage.getItem(STORAGE_KEY) === "1";
} catch {
  // no storage (private mode, etc.) — the in-memory flag still covers this visit
}

export const tutorialCompleted = () => completed;

export function completeTutorial() {
  completed = true;
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // same fallback as the read: memory-only completion for this visit
  }
}

let step = Step.Move;
let finished = false;
let demo: Flower | undefined; // flower the growth/harvest lessons point at
let awaitRing = false; // Noise has fired — waiting for the ring to finish
let revealDelay = 0;

export function begin() {
  step = Step.Move;
  finished = false;
  demo = undefined;
  awaitRing = false;
  revealDelay = 0;
  startRect = null;
  // Every tool stays locked until its lesson; practice never places Repel or
  // Attract, so the gate only ever opens for the Noise lesson.
  setToolGate(TOOL_NONE);
  resetGarden();
}

export const isFinished = () => finished;
// Flowers stay hidden until the growth lesson reveals them.
export const flowersShown = () => step >= Step.Grow;
// The danger lesson brings the weather on so the player sees the warning it
// describes, instead of meeting a gathering storm for the first time mid-run.
export const dangerShown = () => step === Step.Danger;
// Harvesting unlocks with its lesson so the demonstration flower can't be
// picked before the collection instruction has even appeared.
export const harvestingOn = () => step >= Step.Harvest;

// The lesson points at the flower nearest the gardener, so the walk from the
// spawn point to the target is short.
function pickDemo() {
  let bestDist = Infinity;
  for (const bed of beds) {
    for (const f of bed) {
      const d = Math.hypot(f.x - lep.x, f.y - lep.y);
      if (d < bestDist) {
        bestDist = d;
        demo = f;
      }
    }
  }
}

function advance() {
  step++;
  revealDelay = REVEAL[step];
  if (step === Step.Grow) {
    pickDemo();
  } else if (step === Step.Threat) {
    // one calm unicorn to practise on — the lesson's "try it now" needs a
    // live target, and waves stay off during the tutorial
    spawnUnicorn(false, PRACTICE_ENTRY);
  } else if (step === Step.Noise) {
    setToolGate(0); // Noise only, until the lesson has fired it
  } else if (step === Step.Danger) {
    setToolGate(TOOL_NONE); // lesson over — tools lock up again for practice
  }
}

export function update(dt: number) {
  const wasWalking = lep.moving;
  updateLep(dt);
  // Flowers only start living once the growth lesson begins; the lesson
  // itself runs the clock faster so the demonstration doesn't take a season.
  if (step >= Step.Grow) {
    // the harvest lesson keeps the fast clock too: its flower is only at the
    // pre-bloom stage when the panel goes up, and picking needs full growth
    updateGarden(step <= Step.Harvest ? dt * GROWTH_ACCEL : dt);
  }
  if (wasWalking && harvestingOn()) {
    const f = harvestAtPosition(lep.x, lep.y);
    if (f) {
      addCoins(f, true);
      harvested();
    }
  }
  updateNoise(dt);
  // the threat lesson's practice unicorn lives in this list too — the tutorial
  // never runs the wave manager, so this is the only place they move
  updateUnicorns(dt);
  // the threat lesson only moves on once the practice push actually lands:
  // the deflection ring flagging up is the same tell the player sees
  if (step === Step.Threat && lep.blocking) {
    advance();
  }
  // both unicorn lessons need a live target — if the practice uni wanders off
  // the field, roll a fresh one in at the fixed entry so they stay completable
  if ((step === Step.Threat || step === Step.Noise) && !unicorns.length) {
    spawnUnicorn(false, PRACTICE_ENTRY);
  }
  if (awaitRing) {
    // latch on the frame the sweep lands: a scared uni can reach its edge and
    // be spliced before the ring finishes, and the respawn above would hide it
    if (unicorns.some(isScared)) {
      awaitRing = false;
      advance(); // the ring reached a unicorn — now explain Repel and Attract
    } else if (!isRingBusy()) {
      awaitRing = false; // it went off too far away — the lesson waits for another try
    }
  }
  if (revealDelay > 0) {
    revealDelay = Math.max(0, revealDelay - dt);
  }
}

// Advancement comes from real successful actions, never from arbitrary taps.

export function moved() {
  if (step === Step.Move) {
    advance();
  }
}

export function harvested() {
  if (step === Step.Harvest) {
    advance();
  }
}

export function toolUsed(tool: number) {
  if (step === Step.Noise && tool === 0) {
    awaitRing = true;
  }
}

// Panel geometry — fixed at the top of the field so it can never cover a
// bottom-of-screen target or wander off the viewport.
const PANEL_X = 16;
const PANEL_W = VIEW_W - 32;
const PANEL_Y = FIELD_TOP + 8;
const LINE_H = 18;
const PAD = 12;
const HINT = "(click to continue)";
const START = "Start Playing";

type Rect = { x: number; y: number; w: number; h: number };
const inside = (r: Rect | null, x: number, y: number) =>
  !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Rect of the last-drawn Start button, for hit-testing in tap().
let startRect: Rect | null = null;
export const startButtonRect = () => startRect;

// The panel's rect from the last draw — only recorded on lessons that wait
// for a click, so "the whole message is the button" can't skip the
// success-gated lessons (growth, harvest, threat, noise).
let panelRect: Rect | null = null;
/** Panel rect from the last draw — lets tap check against what is actually
 * on screen, and lets the regression check drive the click-to-continue. */
export const continueRect = () => panelRect;

export function tap(x: number, y: number): boolean {
  if (inside(startRect, x, y)) {
    startRect = null; // main.ts resets practice state and starts the run
    finished = true;
    return true;
  }
  if (inside(panelRect, x, y)) {
    advance();
    return true;
  }
  // the growth lesson advances by tapping anywhere — but only once the
  // demonstration flower has grown to one stage before bloom, so the wait
  // can't be skipped and the harvest lesson still gets a blooming to show
  if (step === Step.Grow && demo && demo.growth >= STAGE_BLOOM) {
    advance();
    return true;
  }
  return false;
}

// Bobbing chevron that points at the spot it marks — from below for targets
// up in the HUD strip, otherwise hovering above and pointing down.
function drawArrow(tx: number, ty: number, time: number) {
  const k = 0.5 + 0.5 * Math.sin(time * 5);
  const dir = ty < FIELD_TOP ? -1 : 1;
  const tip = ty - dir * (12 + 4 * k);
  ctx.strokeStyle = `rgba(255,255,255,${0.45 + 0.35 * k})`;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(tx, tip - dir * 18); // stem
  ctx.lineTo(tx, tip - dir * 8);
  ctx.moveTo(tx - 8, tip - dir * 8); // head
  ctx.lineTo(tx, tip);
  ctx.lineTo(tx + 8, tip - dir * 8);
  ctx.stroke();
}

// What the attention arrow points at on this step, if anything. Anything with
// x/y will do, so live entities are handed over as they are.
function arrowTarget(): { x: number; y: number } | undefined {
  switch (step) {
    case Step.Harvest:
      // only once the demonstration flower is actually ripe — STAGE_BLOOM is
      // when petals appear, but the pulsing "tap me" halo (and picking) only
      // start at growth 1
      return demo && demo.growth >= 1 ? demo : undefined;
    case Step.Coins:
      return { x: 40, y: 20 }; // coin counter
    case Step.Rainbow:
      return { x: 196, y: 20 }; // rainbow meter
    case Step.Threat:
      return unicorns[0] ?? lep; // the practice unicorn — "try it now"
    case Step.Noise:
      return toolButtonCenter(0);
    default:
      return;
  }
}

export function draw(time: number) {
  if (revealDelay > 0) {
    // the panel is between lessons — nothing to show, and no stale hit area
    // may keep accepting taps
    panelRect = null;
    startRect = null;
    return;
  }
  const lines = LESSONS[step].split("\n");
  const start = step === Step.Ready; // last lesson: a real button, no hint
  const hint = HINT_STEPS.includes(step);
  const h =
    PAD * 2 +
    lines.length * LINE_H +
    (start ? LINE_H + 16 : hint ? LINE_H + 8 : 0);

  // The opening lesson floats mid-screen; everything else stays pinned to the
  // top of the field so it can never cover a bottom-of-screen target. The
  // rewards panels drop 20px to leave their HUD arrows visible.
  const py =
    step === Step.Move
      ? (VIEW_H - h) / 2
      : PANEL_Y + (step === Step.Coins || step === Step.Rainbow ? 20 : 0);

  // attention arrow first, so the panel paints over it if they overlap
  const target = arrowTarget();
  if (target) {
    drawArrow(target.x, target.y, time);
  }

  ctx.fillStyle = "rgba(10,15,30,0.85)";
  ctx.beginPath();
  ctx.roundRect(PANEL_X, py, PANEL_W, h, 10);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "13px sans-serif";
  lines.forEach((line, i) => {
    ctx.fillText(line, VIEW_W / 2, py + PAD + 13 + i * LINE_H);
  });

  // the whole message is the hit area — no separate button to aim for
  panelRect = hint ? { x: PANEL_X, y: py, w: PANEL_W, h } : null;
  if (hint) {
    ctx.fillStyle = "#9fb8d8";
    ctx.font = "11px sans-serif";
    ctx.fillText(HINT, VIEW_W / 2, py + PAD + 13 + lines.length * LINE_H);
  }

  startRect = null;
  if (start) {
    const bw = 130;
    const bh = 26;
    const bx = (VIEW_W - bw) / 2;
    const by = py + h - bh - PAD; // same margin as the text has at the top
    // same blue/yellow pairing as the HUD's music button, so every tappable
    // chrome control in the game reads as one family
    ctx.fillStyle = "#2a4a73";
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 8);
    ctx.fill();
    ctx.fillStyle = "#ffd54a";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(START, VIEW_W / 2, by + 17);
    startRect = { x: bx, y: by, w: bw, h: bh };
  }

  // progress marker, tucked into the top-right corner clear of the text
  ctx.fillStyle = "#9fb8d8";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(
    `${step + 1} / ${LESSONS.length}`,
    PANEL_X + PANEL_W - 10,
    py + 16,
  );
}
