// Tutorial state-machine regression check. Runs the real src/tutorial.ts in
// Node through Vite's SSR loader with a stubbed DOM — no test framework, just
// assertions and an exit code. Companion runner: scripts/check-tutorial.mjs.

// --- DOM stubs (tutorial.ts's import graph touches canvas/audio at load) ---
const noop = () => {};
const gradient = { addColorStop: noop };
const ctxStub = new Proxy(
  {},
  {
    get: (_t, prop) => {
      if (prop === "createRadialGradient" || prop === "createLinearGradient") {
        return () => gradient;
      }
      return noop;
    },
    set: () => true,
  },
);
const canvasStub = {
  getContext: () => ctxStub,
  addEventListener: noop,
  width: 360,
  height: 640,
};
globalThis.document = { querySelector: () => canvasStub };
globalThis.addEventListener = noop;
globalThis.devicePixelRatio = 1;
globalThis.innerWidth = 360;
globalThis.innerHeight = 640;
// the sprite paths only ever reach the stubbed ctx as fill/stroke arguments
globalThis.Path2D = class {
  addPath = noop;
};

const store: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => {
    delete store[k];
  },
};

// --- assertions ---
let failed = 0;
function check(name: string, ok: boolean) {
  if (!ok) {
    failed++;
    console.error(`FAIL ${name}`);
  } else {
    console.log(`ok   ${name}`);
  }
}

const t = await import("../src/tutorial.ts");
const TICK = 1 / 60;

// fresh visit: nothing stored, tutorial not completed
check("fresh load is not completed", !t.tutorialCompleted());

t.begin();
check("starts before flowers are shown", !t.flowersShown());
check("starts with harvesting locked", !t.harvestingOn());

// the movement lesson only advances on a real move
t.harvested();
check("harvest ignored before its lesson", !t.harvestingOn());
t.moved();
check("move unlocks the growth lesson", t.flowersShown());
check("growth lesson keeps harvesting locked", !t.harvestingOn());

// harvesting stays gated while the demonstration flower grows
t.harvested();
check("harvest ignored during growth lesson", !t.harvestingOn());

// tapping anywhere mid-growth must not skip the wait
t.update(TICK * 10); // grow a little, nowhere near the pre-bloom stage
t.tap(180, 320);
check("early tap does not skip the growth lesson", !t.harvestingOn());

// the accelerated demonstration reaches one stage before bloom within ~6
// simulated seconds, but the lesson only moves on once the player taps
let frames = 0;
while (frames < 6 * 60) {
  t.update(TICK);
  frames++;
}
check("harvesting stays locked until tapped", !t.harvestingOn());
t.tap(180, 320);
check("tap after pre-bloom growth advances to harvest", t.harvestingOn());

// walk the continue-driven steps to the tools lesson. Each advance starts a
// 1 s reveal delay, so burn it with an update before drawing; the button is
// then driven through the same tap path the player uses.
// the click-to-continue panel is driven through the same tap path the player
// uses; lessons without a hint (e.g. "tap Noise") just no-op, as for the player
const tapButton = () => {
  const b = t.continueRect();
  if (b) {
    t.tap(b.x + b.w / 2, b.y + b.h / 2);
  }
};
const continueThrough = (n: number) => {
  for (let i = 0; i < n; i++) {
    t.update(1);
    t.draw(0);
    tapButton();
  }
};
t.harvested();
continueThrough(2); // rewards x2 -> threat lesson

// the threat lesson only moves on when the practice push lands: let the
// practice unicorn finish its entry warning and step onto the lawn, then park
// its waypoint far away (so standing next to it can't read as camping) and
// put the lep inside his push radius
const { lep } = await import("../src/leprechaun.ts");
const u = (await import("../src/unicorn.ts")).unicorns[0];
for (let i = 0; i < 90; i++) {
  t.update(TICK); // 1.5 s > the warning hold
}
u.wx = -100;
lep.x = u.x + 25;
lep.y = u.y;
t.update(TICK);
check("pushing the practice unicorn advances to tools", u.spookTimer > 0);

// only Noise counts, and only when the ring actually reaches the unicorn
t.toolUsed(1);
t.update(TICK);
continueThrough(2);
// the Start button only exists on the last lesson, so its absence after the
// reveal delays have burned is the tell that the tools lesson didn't advance
t.draw(0);
check("repel/attract do not advance the tools lesson", !t.startButtonRect());

// a Noise fired out of the unicorn's reach must not advance: fire it far
// away, run the ring out, and confirm the lesson is still waiting
t.toolUsed(0);
t.update(2); // burn the tools delay and run the stub's instant ring out
t.draw(0);
check("noise far from the unicorn does not advance", !t.startButtonRect());

// now stand the lep inside ring range (RING_MAX = 100) and fire again —
// startRing is what useTool calls in the real game
lep.x = u.x + 30;
lep.y = u.y;
t.toolUsed(0);
const { startRing } = await import("../src/noise.ts");
startRing();
continueThrough(1); // runs the ring out; the sweep scares the uni, panel follows
continueThrough(1); // the danger lesson sits between the tools and the start
t.update(1); // burn the ready step's reveal delay
t.draw(0);
// the last lesson has a real Start button instead of a continue panel
const sb = t.startButtonRect();
check("noise use advances to the ready step", !!sb);
if (sb) {
  t.tap(sb.x + sb.w / 2, sb.y + sb.h / 2);
}
check("final button finishes the tutorial", t.isFinished());

// completion persists, and survives a failing storage write
t.completeTutorial();
check("completion stored", store["off-my-lawn:tutorial-completed"] === "1");
globalThis.localStorage.setItem = () => {
  throw new Error("quota");
};
t.completeTutorial();
check("storage failure does not throw", true);

// a fresh module instance (fresh page load) reads the stored flag
const fresh = await import("../src/tutorial.ts?fresh");
check("fresh load reads stored completion", fresh.tutorialCompleted());

if (failed > 0) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log("all tutorial checks passed");
