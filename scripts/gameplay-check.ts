// Gameplay regression check: the win threshold, the chosen loss rule, the
// lep's movement boundaries, and the defence interactions (spook/camping,
// repellent, lure, noise ring, water ring, trample). Runs the real src
// modules in Node through Vite's SSR loader with a stubbed DOM — no test
// framework, just assertions and an exit code. Companion runner:
// scripts/check-gameplay.mjs.

// --- DOM stubs (the import graph touches canvas/audio at load) ---
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

// Pin randomness so spawn points, bed scatter and the wander-notice roll are
// all deterministic. 0.99 never fires the notice roll and always takes the
// last spawn entry — every assertion below stays exact.
Math.random = () => 0.99;

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

const TICK = 1 / 60;

const {
  FIELD_BOTTOM,
  FIELD_TOP,
  beds,
  gardenBare,
  gardenStumped,
  harvestAtPosition,
  resetGarden,
  ruinProgress,
  trample,
} = await import("../src/garden.ts");
const { PRICES, addCoins, getCoins, rainbowDone, resetHud } = await import(
  "../src/hud.ts"
);
const { LEP_START, lep, sendLepTo, updateLep } = await import(
  "../src/leprechaun.ts"
);
const { isRingBusy, startRing, updateNoise } = await import("../src/noise.ts");
const {
  attractors,
  inRepellent,
  placeAttractor,
  placeRepellent,
  repellents,
  updatePlaceables,
} = await import("../src/placeable.ts");
const { VIEW_W } = await import("../src/canvas.ts");
const { toolButtonCenter, toolbarTap } = await import("../src/toolbar.ts");
const { raidOver, scareUnicorns, spawnUnicorn, unicorns, updateUnicorns } =
  await import("../src/unicorn.ts");
const { resetWaves, updateWaves } = await import("../src/wave.ts");

// Mirrors of the module-local const enums (they erase at build time and are
// deliberately not exported). A reorder breaks these checks loudly — the
// failure itself is the signal to update them.
const GROWING = 0;
const TRAMPLED = 1;
const WITHERING = 2;
const WARN = 0;
const WANDER = 1;
const NOTICE = 2;
const TARGET = 3;
const LEAVE = 4;
const SCARED = 5;
const LURED = 6;

const flowers = () => beds.flat();
const spawnAt = (x: number, y: number) => {
  spawnUnicorn(false, { x, y });
  return unicorns[unicorns.length - 1];
};
const resetField = () => {
  unicorns.length = 0;
  repellents.length = 0;
  attractors.length = 0;
  lep.x = lep.tx = LEP_START.x;
  lep.y = lep.ty = LEP_START.y;
  lep.moving = false;
  lep.blocking = false;
};

// --- win threshold: the rainbow meter fills at exactly 30 points ---
resetHud();
const bank = PRICES[0] + PRICES[1];
check("a fresh run has not won", !rainbowDone());
// alternating hues keep every harvest a flat 1-point chain
for (let i = 0; i < 29; i++) {
  addCoins({ x: 0, y: 0, hue: i % 2 ? 0 : 30 });
}
check("29 points do not win", !rainbowDone());
addCoins({ x: 0, y: 0, hue: 0 }); // differs from the last chained hue
check("the 30th point wins exactly", rainbowDone());
check("30 lone blooms paid 5 coins each", getCoins() === bank + 150);

// same-hue chains pay 1/2/3 and cap there — the 4th bloom in a row adds no
// more than the 3rd
resetHud();
addCoins({ x: 0, y: 0, hue: 0 });
addCoins({ x: 0, y: 0, hue: 0 });
addCoins({ x: 0, y: 0, hue: 0 });
addCoins({ x: 0, y: 0, hue: 0 });
check("combo chain caps at 3", getCoins() === bank + 45);
check("a combo run alone stays under the threshold", !rainbowDone());

// tutorial harvests pay coins but never fill the meter
resetHud();
for (let i = 0; i < 29; i++) {
  addCoins({ x: 0, y: 0, hue: i % 2 ? 0 : 30 }, true);
}
check("practice harvests never fill the meter", !rainbowDone());
check("practice harvests still pay coins", getCoins() === bank + 145);
addCoins({ x: 0, y: 0, hue: 0 });
check("one real harvest after practice stays under the line", !rainbowDone());
for (let i = 0; i < 29; i++) {
  addCoins({ x: 0, y: 0, hue: i % 2 ? 30 : 0 });
}
check(
  "real harvests complete the rainbow from a practiced start",
  rainbowDone(),
);

// --- loss rule: most of what was left to defend, with a floor ---
// 21 flowers total; the ruin line is max(5, ceil((21 - picked) * 0.7))
resetGarden();
const fs = flowers();
check("a fresh garden is not lost", !gardenStumped());
for (let i = 0; i < 14; i++) {
  trample(fs[i]);
}
check("14 stomps stay under the full-pool ruin line", !gardenStumped());
trample(fs[14]);
check("the 15th stump loses a full pool", gardenStumped());

// banked blooms leave the pool instead of shielding it: 10 picked drops the
// line from 15 to ceil(11 * 0.7) = 8
resetGarden();
for (const f of fs.slice(0, 10)) {
  f.growth = 1; // mature — the walk-over harvest only takes ripe flowers
}
for (let i = 0; i < 10; i++) {
  harvestAtPosition(fs[i].x, fs[i].y);
}
for (let i = 10; i < 17; i++) {
  trample(fs[i]);
}
check("7 stomps stay under the shrunken pool's line", !gardenStumped());
trample(fs[17]);
check(
  "the 8th stump loses once a third of the pool is banked",
  gardenStumped(),
);

// harvesting can never be what loses the wave: 14 stomps sit right under the
// full-pool line of 15, and picking a bloom would otherwise drop that line to 14
resetGarden();
for (let i = 0; i < 14; i++) {
  trample(fs[i]);
}
fs[14].growth = 1;
harvestAtPosition(fs[14].x, fs[14].y);
check("harvesting at the brink doesn't lose the wave", !gardenStumped());
trample(fs[15]);
check("the next stomp still loses it", gardenStumped());

// the weather reads off the line, and clears once the wave can't be lost
resetGarden();
for (let i = 0; i < 12; i++) {
  trample(fs[i]);
}
check("stomps toward the line raise the ruin reading", ruinProgress() > 0.5);
for (const f of fs.slice(12)) {
  f.growth = 1;
  harvestAtPosition(f.x, f.y);
}
check("a harvested-out garden reads as safe", ruinProgress() === 0);

// the floor keeps a near-emptied garden from ending on a single stomp:
// 16 picked leaves a pool of 5, where ceil(5 * 0.7) = 4 but the line holds at 5
resetGarden();
for (const f of fs.slice(0, 16)) {
  f.growth = 1;
}
for (let i = 0; i < 16; i++) {
  harvestAtPosition(fs[i].x, fs[i].y);
}
for (let i = 16; i < 20; i++) {
  trample(fs[i]);
}
check("4 stomps stay safe under the floor", !gardenStumped());
trample(fs[20]);
check("the 5th stump hits the floor and loses", gardenStumped());

// no Growing flower left means nothing more to lose, sprouts included
resetGarden();
for (const f of fs) {
  trample(f);
}
check("a fully flattened garden is bare", gardenBare());

// --- movement boundaries: the field clamp, the walk, the arrival ---
resetField();
sendLepTo(180, FIELD_TOP - 50);
check("the top edge clamps inside the field", lep.ty === FIELD_TOP + 12);
sendLepTo(180, FIELD_BOTTOM + 100);
check("the bottom edge clamps above the toolbar", lep.ty === FIELD_BOTTOM - 8);
sendLepTo(-211, 500);
check("a left-of-screen x clamps to the lawn edge", lep.tx === 0);
sendLepTo(VIEW_W + 211, 500);
check("a right-of-screen x clamps to the lawn edge", lep.tx === VIEW_W);

sendLepTo(180, 100);
updateLep(1);
check("he walks his speed per second", lep.x === 180 && lep.y === 390);
updateLep(10);
check(
  "he stops exactly on the target and settles",
  !lep.moving && lep.y === 100,
);
updateLep(1);
check("a settled lep ignores further updates", lep.x === 180 && lep.y === 100);

// --- defence: the lep's presence spooks, unless he's camping ---
resetField();
const spooked = spawnAt(200, 300);
spooked.state = WANDER; // past the entry warning
lep.x = spooked.x + 30; // inside his presence radius
lep.y = spooked.y;
spooked.wx = -100; // waypoint far away — not camping
updateUnicorns(TICK);
check("the lep's presence spooks a nearby unicorn", spooked.spookTimer > 0);
updateUnicorns(TICK); // the ring flag lights on the first spooked frame
check("spooking lights the deflection ring", lep.blocking);

resetField();
const camper = spawnAt(230, 300);
camper.state = WANDER;
lep.x = 200; // 30 px away — inside the spook radius
lep.y = 300;
camper.wx = 200; // but its destination is the lep himself
camper.wy = 300;
updateUnicorns(TICK);
check("camping the destination beats the spook", camper.spookTimer === 0);

resetField();
const entering = spawnAt(200, 300); // still in its entry warning
entering.wx = -100;
lep.x = entering.x + 10;
lep.y = entering.y;
updateUnicorns(TICK);
check(
  "a unicorn mid-warning cannot be spooked",
  entering.spookTimer === 0 && entering.state === WARN,
);

// --- defence: the repellent shields and invalidates ---
resetField();
resetGarden();
const shielded = spawnAt(100, 300);
shielded.state = WANDER;
const covered = beds[0][0];
placeRepellent(covered.x, covered.y);
check("the repellent covers its flower", inRepellent(covered.x, covered.y));
check(
  "the repellent field ends at its radius",
  inRepellent(covered.x + 45, covered.y) &&
    !inRepellent(covered.x + 47, covered.y),
);
shielded.state = TARGET;
shielded.target = covered;
updateUnicorns(TICK);
check(
  "a repellent on the target aborts the raid",
  shielded.target === undefined && shielded.state === WANDER,
);

// --- defence: the attractor lure ---
resetField();
const lured = spawnAt(200, 300);
lured.state = WANDER;
placeAttractor(310, 300); // beyond the lure's pull
updateUnicorns(TICK);
check("a lure out of reach does not pull", lured.state === WANDER);
attractors.length = 0;
placeAttractor(290, 300); // inside the pull
updateUnicorns(TICK);
check(
  "a lure in reach pulls the unicorn to it",
  lured.state === LURED && lured.wx === 290 && lured.wy === 300,
);
lured.state = NOTICE;
lured.timer = 1;
lured.target = beds[0][0];
updateUnicorns(TICK);
check(
  "the lure outranks a flower it already noticed",
  lured.state === LURED && lured.target === undefined,
);
for (const a of attractors) {
  a.life = 0.01;
}
updatePlaceables(0.02);
updateUnicorns(TICK);
check("an expired lure releases the unicorn", lured.state === WANDER);

resetField();
const leaver = spawnAt(200, 300);
leaver.state = LEAVE;
leaver.wx = VIEW_W + 30; // heading for the edge = despawn
leaver.wy = 300;
placeAttractor(210, 300);
updateUnicorns(TICK);
check(
  "a leaving unicorn ignores the lure",
  leaver.state === LEAVE && leaver.wx === VIEW_W + 30,
);

// --- defence: the noise ring scares as it sweeps ---
resetField();
const near = spawnAt(200, 300);
const far = spawnAt(320, 300);
scareUnicorns(120, 300, 100); // reaches the near uni (80 px), not the far one
check("the noise front scares unicorns it reaches", near.state === SCARED);
check("distant unicorns ignore the noise", far.state === WARN);
check(
  "scared unicorns flee to the far edge",
  near.wx === VIEW_W + 30 && near.wy === 300,
);
scareUnicorns(0, 0, 1000); // a second sweep must not re-task the scared one
check("re-sweeps skip already-scared unicorns", near.wx === VIEW_W + 30);

resetField();
lep.x = 100;
lep.y = 300;
const inner = spawnAt(150, 300); // 50 px out — inside the ring's max reach
const outer = spawnAt(250, 300); // 150 px out — beyond it forever
startRing();
updateNoise(0.3); // the eased sweep has reached radius ~51
check("the ring is busy while sweeping", isRingBusy());
check(
  "the ring scares as it expands, not all at once",
  inner.state === SCARED && outer.state === WARN,
);
updateNoise(1);
check("the ring never reaches past its max radius", outer.state === WARN);
check("a finished ring frees the toolbar", !isRingBusy());

// --- defence: the water ring boosts each growing flower once per wave ---
resetField();
resetGarden();
lep.x = 100;
lep.y = 300;
const wet = beds[0][0];
const dry = beds[0][1];
wet.x = 120; // 20 px from the lep — inside the bottle's reach
wet.y = 300;
dry.x = 300; // 200 px — beyond it
dry.y = 300;
for (const f of [wet, dry]) {
  f.state = GROWING;
  f.growth = 0.5;
  f.watered = false;
  f.rate = 0.05;
}
startRing(true);
updateNoise(1);
check(
  "watering boosts the reached flower's rate",
  Math.abs(wet.rate - 0.05 * 1.5) < 1e-12,
);
check("a watered flower is flagged for the wave", wet.watered);
check(
  "out-of-reach flowers keep their own pace",
  dry.rate === 0.05 && !dry.watered,
);
const boosted = wet.rate;
startRing(true);
updateNoise(1);
check("a second watering is a no-op", wet.rate === boosted);

// --- the toolbar refuses a watering that would boost nothing ---
resetHud();
addCoins(50);
const waterBtn = toolButtonCenter(3);
const purse = getCoins();
check(
  "water is refused when every flower in reach is already boosted",
  toolbarTap(waterBtn.x, waterBtn.y) === -1 && getCoins() === purse,
);
wet.watered = false;
wet.growth = 1; // mature: a faster rate buys it nothing
check(
  "water is refused when the flower in reach is fully grown",
  toolbarTap(waterBtn.x, waterBtn.y) === -1 && getCoins() === purse,
);
wet.growth = 0.5;
check(
  "water is sold when a growing flower is in reach",
  toolbarTap(waterBtn.x, waterBtn.y) === 3 && getCoins() < purse,
);
// bare ground is not a no-op to refuse: with nothing in reach the bottle stays live
for (const bed of beds) {
  for (const f of bed) {
    f.x = -500;
  }
}
resetHud();
addCoins(50);
const bare = getCoins();
check(
  "water is sold where there is no flower at all",
  toolbarTap(waterBtn.x, waterBtn.y) === 3 && getCoins() < bare,
);

// --- trample: hooves only hurt what has sprouted past a sprout ---
resetField();
resetGarden();
spawnAt(200, 300);
const bloom = beds[1][0];
bloom.x = 200;
bloom.y = 300;
bloom.growth = 1;
const sprout = beds[1][1];
sprout.x = 200; // directly under the hooves too
sprout.y = 300;
sprout.growth = 0.2;
updateUnicorns(TICK);
check("standing blooms trample underfoot", bloom.state === TRAMPLED);
check("sprouts are beneath a trample", sprout.state === GROWING);

// --- season ending: the raid is over before the last tail clears the edge,
// and the beds stay up for a grace window so a cleared garden pays out ---
resetField();
resetGarden();
resetWaves();
// wave 1's roster is 6 and its spawn gap 4 s; clearing the field each step
// keeps the per-wave cap from stalling the roster
const burnRoster = () => {
  for (let i = 0; i < 6; i++) {
    updateWaves(4);
    unicorns.length = 0;
  }
};
burnRoster();
const straggler = spawnAt(200, 300);
straggler.state = WANDER;
check("a unicorn still on the prowl holds the raid open", !raidOver());
straggler.state = LURED;
check("a lured unicorn is still a threat", !raidOver());
straggler.state = LEAVE;
check("one walking home doesn't hold the season open", raidOver());

resetField();
resetGarden();
resetWaves();
for (const f of flowers()) {
  f.growth = 1;
}
burnRoster();
updateWaves(TICK); // roster spent and the lawn clear — the grace opens
updateWaves(3); // still inside the 4 s window
check(
  "the grace window leaves the beds standing",
  flowers().every((f) => f.state === GROWING),
);
check(
  "a cleared garden can still be harvested during the grace",
  !!harvestAtPosition(flowers()[0].x, flowers()[0].y),
);
updateWaves(1.5); // past the grace, into the droop
check(
  "survivors droop once the grace closes",
  flowers().some((f) => f.state === WITHERING),
);
updateWaves(2); // tail spent — the next season sows
check(
  "the next season starts from bare sprouts",
  flowers().every((f) => f.growth === 0 && f.state === GROWING),
);

if (failed > 0) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log("all gameplay checks passed");
