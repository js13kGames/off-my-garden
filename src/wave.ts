import { gardenBare, resetGarden, witherGarden } from "./garden";
import { leaveUnicorns, spawnUnicorn, unicorns } from "./unicorn";

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
  return Math.min(0.35 + (wave - 1) * 0.08, 0.9);
}

// ponytail: no lose condition yet, waves just escalate forever and coins are
// the score. Post-POC candidates (see README "Game structure"): a money
// goal, a rainbow-power meter with celebration + best-count, or a timed
// session scored at the end.

let wave = 1;
let spawned = 0;
let spawnTimer = 1; // small delay before the first unicorn of a run
const INTERMISSION_TIME = 2.5;
let intermission = 0;

/** Advances the wave clock: spawns the roster, and once it's gone, withers
 * and resets the garden before starting the next wave right away. */
export function updateWaves(dt: number) {
  if (intermission > 0) {
    intermission -= dt;
    if (intermission <= 0) {
      wave++;
      spawned = 0;
      spawnTimer = spawnEveryFor(wave);
      // new growing season: every flower starts over at stage 0
      resetGarden();
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
    }
  } else if (unicorns.length === 0) {
    // every unicorn this wave spawned is gone — send survivors into their
    // droop-and-fade so the next reset doesn't just snap them away
    witherGarden();
    intermission = INTERMISSION_TIME;
  }
}
