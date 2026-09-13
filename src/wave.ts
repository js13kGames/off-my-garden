import { gardenBare, resetGarden, witherGarden } from "./garden";
import { leaveUnicorns, raidOver, spawnUnicorn, unicorns } from "./unicorn";

// Difficulty escalates by formula rather than a per-wave table — one place to
// tune, and it keeps stepping up indefinitely instead of running out of rows.
function rosterFor(wave: number) {
  return 6 + (wave - 1) * 3;
}
function capFor(wave: number) {
  return Math.min(3 + ((wave - 1) >> 1), 8);
}
function spawnEveryFor(wave: number) {
  return Math.max(1.2, 4 - (wave - 1) * 0.25);
}
function nervousChanceFor(wave: number) {
  // wave 1 is all calm unicorns — the player is still learning the controls
  return wave < 2 ? 0 : Math.min(0.35 + (wave - 2) * 0.08, 0.9);
}

let wave = 1;
let spawned = 0;
let seen = 0; // unicorns spawned across the whole run
let spawnTimer = 1; // small delay before the first unicorn of a run
// A season ends on a garden still standing: once nothing on the lawn is a
// threat any more, the beds stay up for a grace window so clearing the raid
// early pays — the player gets to walk the rows and cash in what survived —
// and only then do the survivors droop away. The tail is the droop itself
// (garden.ts's WITHER_TIME) plus a beat of bare soil before the next sowing.
const GRACE_TIME = 4;
const WITHER_TAIL = 2;
const INTERMISSION_TIME = GRACE_TIME + WITHER_TAIL;
let intermission = 0;

// For the end panel's message.
export const unicornsSeen = () => seen;

/** Back to wave 1 with an empty roster, for a restart. */
export function resetWaves() {
  wave = 1;
  spawned = 0;
  seen = 0;
  spawnTimer = 1;
  intermission = 0;
}

/** Advances the wave clock: spawns the roster, and once the raid is over,
 * runs the harvest grace, withers the survivors, and resets the garden for
 * the next wave. */
export function updateWaves(dt: number) {
  if (intermission > 0) {
    const wasGrace = intermission > WITHER_TAIL;
    intermission -= dt;
    // crossing out of the grace window is the moment the harvest closes
    if (wasGrace && intermission <= WITHER_TAIL) {
      witherGarden();
    }
    if (intermission <= 0) {
      wave++;
      spawned = 0;
      spawnTimer = spawnEveryFor(wave);
      // new growing season: every flower starts over at stage 0
      resetGarden(wave);
    }
    return;
  }
  // Nothing left to raid: send the roster home instead of letting it wander
  // an empty lawn, and stop spawning more of it.
  const bare = gardenBare();
  if (bare) {
    leaveUnicorns();
  }
  if (!bare && spawned < rosterFor(wave)) {
    spawnTimer -= dt;
    if (spawnTimer <= 0 && unicorns.length < capFor(wave)) {
      spawnTimer = spawnEveryFor(wave);
      spawnUnicorn(Math.random() < nervousChanceFor(wave));
      spawned++;
      seen++;
    }
  } else if (raidOver()) {
    // the roster is spent and whoever is left is already walking off: open
    // the harvest grace now rather than waiting for the last tail to clear
    // the edge. They finish their exit while the player works the rows.
    // A bare garden skips the grace: there is nothing left to cash in, so
    // the window would just be dead time.
    intermission = bare ? WITHER_TAIL : INTERMISSION_TIME;
  }
}
