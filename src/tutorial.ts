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
const enum Step {
  Move,
  Grow,
  Harvest,
  Rewards,
  Threat,
  Tools,
  Ready,
}

const STEP_COUNT = 7;
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
let phase = 0; // sub-step inside the two-panel lessons (Rewards, Tools)
let finished = false;
let demo: Flower | undefined; // flower the growth/harvest lessons point at
let awaitRing = false; // Noise has fired — waiting for the ring to finish
// Seconds between a lesson's trigger and its panel showing — the world reacts
// first, the explanation follows a beat later. Steps left out of the table use
// the default; the harvest lesson skips the wait so its just-blooming flower
// can be collected while the panel is up.
const DEFAULT_REVEAL = 1;
const REVEAL_DELAYS: Partial<Record<Step, number>> = {
  [Step.Harvest]: 0,
  [Step.Rewards]: 0.5, // harvest → rewards reads as one beat, not a new scene
  [Step.Ready]: 0.5, // tools → ready ditto
};
let revealDelay = 0;

export function begin() {
  step = Step.Move;
  phase = 0;
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
// Harvesting unlocks with its lesson so the demonstration flower can't be
// picked before the collection instruction has even appeared.
export const harvestingOn = () => step >= Step.Harvest;

// The lesson points at the flower nearest the gardener, so the walk from the
// spawn point to the target is short.
function pickDemo() {
  let best: Flower | undefined;
  let bestDist = Infinity;
  for (const bed of beds) {
    for (const f of bed) {
      const d = Math.hypot(f.x - lep.x, f.y - lep.y);
      if (d < bestDist) {
        bestDist = d;
        best = f;
      }
    }
  }
  demo = best;
}

function advance() {
  step++;
  phase = 0;
  revealDelay = REVEAL_DELAYS[step] ?? DEFAULT_REVEAL;
  if (step === Step.Grow) {
    pickDemo();
  } else if (step === Step.Threat) {
    // one calm unicorn to practise on — the lesson's "try it now" needs a
    // live target, and waves stay off during the tutorial
    spawnUnicorn(false, PRACTICE_ENTRY);
  } else if (step === Step.Tools) {
    setToolGate(0); // Noise only, until the lesson has fired it
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
  if (
    (step === Step.Threat || (step === Step.Tools && phase === 0)) &&
    !unicorns.length
  ) {
    spawnUnicorn(false, PRACTICE_ENTRY);
  }
  if (awaitRing) {
    // latch on the frame the sweep lands: a scared uni can reach its edge and
    // be spliced before the ring finishes, and the respawn above would hide it
    if (unicorns.some(isScared)) {
      awaitRing = false;
      phase = 1; // the ring reached a unicorn — now explain Repel and Attract
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
  if (step === Step.Tools && phase === 0 && tool === 0) {
    awaitRing = true;
  }
}

function doContinue() {
  if (step === Step.Rewards) {
    if (phase === 0) {
      phase = 1; // coins explained — now the rainbow meter
    } else {
      advance();
    }
  } else if (step === Step.Tools && phase === 1) {
    setToolGate(TOOL_NONE); // lesson over — tools lock up again for practice
    advance();
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

// Rect of the last-drawn Start button, for hit-testing in tap().
let startRect: { x: number; y: number; w: number; h: number } | null = null;
export const startButtonRect = () => startRect;

// The panel's rect from the last draw — only recorded on lessons that wait
// for a click, so "the whole message is the button" can't skip the
// success-gated lessons (growth, harvest, threat, noise).
let panelRect: { x: number; y: number; w: number; h: number } | null = null;

export function tap(x: number, y: number): boolean {
  const s = startRect;
  if (s && x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) {
    startRect = null; // main.ts resets practice state and starts the run
    finished = true;
    return true;
  }
  const b = panelRect;
  if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
    doContinue();
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

/** Panel rect from the last draw — lets tap check against what is actually
 * on screen, and lets the regression check drive the click-to-continue. */
export const continueRect = () => panelRect;

type Target = { x: number; y: number; r: number };

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

function lesson(): {
  lines: string[];
  hint?: boolean;
  start?: boolean;
  target?: Target;
  offsetY?: number;
} {
  switch (step) {
    case Step.Move:
      return { lines: ["Tap the screen to move."] };
    case Step.Grow:
      return {
        lines: ["Flowers grow over time.", "Blooms are ready to be picked."],
      };
    case Step.Harvest:
      return {
        lines: [
          "Collect flowers by tapping or",
          "walking through them.",
          "Move close before tapping a bloom.",
        ],
        // arrow only once the demonstration flower is actually ripe —
        // STAGE_BLOOM is when petals appear, but the pulsing "tap me" halo
        // (and picking) only start at growth 1
        target:
          demo && demo.growth >= 1
            ? { x: demo.x, y: demo.y, r: 30 }
            : undefined,
      };
    case Step.Rewards:
      // the HUD targets' arrows sit just under the panel's default spot, so
      // the box drops 20px to leave them visible
      return phase === 0
        ? {
            lines: [
              "Flowers earn coins for tools.",
              "Same colour in a row pays more.",
            ],
            target: { x: 40, y: 20, r: 20 }, // coin counter
            hint: true,
            offsetY: 20,
          }
        : {
            lines: ["Fill the rainbow to win!"],
            target: { x: 196, y: 20, r: 22 }, // rainbow meter
            hint: true,
            offsetY: 20,
          };
    case Step.Threat: {
      // the arrow marks the practice unicorn — "try it now" points at it
      const u = unicorns[0];
      return {
        lines: [
          "Unicorns trample your flowers.",
          "Move near unicorns to push them away.",
          "Try it now.",
        ],
        target: u ? { x: u.x, y: u.y, r: 30 } : { x: lep.x, y: lep.y, r: 30 },
      };
    }
    case Step.Tools:
      return phase === 0
        ? {
            lines: [
              "Tap noise to send them back.",
              "Use when close to a unicorn.",
              "Try it!",
            ],
            target: { ...toolButtonCenter(0), r: 30 },
          }
        : {
            lines: [
              "Repel protects a patch.",
              "Attract lures unicorns away.",
              "Place it away from flowers.",
            ],
            hint: true,
          };
    case Step.Ready:
      // last lesson: a real button instead of the click-to-continue hint
      return {
        lines: [
          "Harvest flowers,  complete your rainbow.",
          "Don't let unicorns trample them all!",
          "Fresh flowers grow each season.",
        ],
        start: true,
      };
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
  const { lines, hint, start, target, offsetY } = lesson();
  const h =
    PAD * 2 +
    lines.length * LINE_H +
    (start ? LINE_H + 16 : hint ? LINE_H + 8 : 0);

  // The opening lesson floats mid-screen; everything else stays pinned to the
  // top of the field so it can never cover a bottom-of-screen target.
  const py = step === Step.Move ? (VIEW_H - h) / 2 : PANEL_Y + (offsetY ?? 0);

  // attention arrow first, so the panel paints over it if they overlap
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

  if (hint) {
    ctx.fillStyle = "#9fb8d8";
    ctx.font = "11px sans-serif";
    ctx.fillText(HINT, VIEW_W / 2, py + PAD + 13 + lines.length * LINE_H);
    // the whole message is the hit area — no separate button to aim for
    panelRect = { x: PANEL_X, y: py, w: PANEL_W, h };
  } else {
    panelRect = null;
  }

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
  } else {
    startRect = null;
  }

  // progress marker, tucked into the top-right corner clear of the text
  ctx.fillStyle = "#9fb8d8";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`${step + 1} / ${STEP_COUNT}`, PANEL_X + PANEL_W - 10, py + 16);
}
