import { ctx, VIEW_W } from "./canvas";
import { beds, FIELD_BOTTOM, FIELD_TOP, type Flower, trample } from "./garden";

// module-local: an exported const enum would stop erasing under isolatedModules
const enum UnicornState {
  Warn,
  Wander,
  Notice,
  Target,
  Leave,
  Scared,
}

export type Unicorn = {
  x: number;
  y: number;
  state: UnicornState;
  timer: number;
  wx: number; // current waypoint
  wy: number;
  hops: number; // wander waypoints left before heading for an exit
  speed: number;
  legPhase: number;
  target?: Flower; // noticed flower, set while Notice/Target
};

export const unicorns: Unicorn[] = [];

// Early game: only a few unicorns at once (waves escalate this later)
const CAP = 3;
const WARN_TIME = 1.2;
// The telegraph: pause before committing to a flower is the player's reaction window.
const NOTICE_TIME = 0.7;
const NOTICE_RADIUS = 70;
const NOTICE_RATE = 0.4; // chance/second of noticing a flower while wandering
// Flowers this close to a unicorn's hooves get trampled, in any state — a hit
// radius smaller than the 28px flower spacing so a pass-through costs one or
// two flowers, not the whole bed.
const TRAMPLE_RADIUS = 9;
const SPAWN_EVERY = 4;
let spawnTimer = 2;

// 8 entry points just outside the playfield edges
const SPAWNS = [
  { x: 100, y: FIELD_TOP - 30 },
  { x: 260, y: FIELD_TOP - 30 },
  { x: -30, y: 180 },
  { x: -30, y: 380 },
  { x: VIEW_W + 30, y: 220 },
  { x: VIEW_W + 30, y: 420 },
  { x: 120, y: FIELD_BOTTOM + 30 },
  { x: 240, y: FIELD_BOTTOM + 30 },
];

function bedAt(x: number, y: number, pad: number) {
  for (const b of beds) {
    if (
      x > b.x - pad &&
      x < b.x + b.w + pad &&
      y > b.y - pad &&
      y < b.y + b.h + pad
    ) {
      return b;
    }
  }
  return undefined;
}

// random point in the open walkways (never inside an inflated bed rect)
function openPoint() {
  for (let i = 0; i < 30; i++) {
    const x = 25 + Math.random() * 310;
    const y = FIELD_TOP + 30 + Math.random() * (FIELD_BOTTOM - FIELD_TOP - 60);
    if (!bedAt(x, y, 16)) {
      return { x, y };
    }
  }
  return { x: 180, y: 380 }; // central walkway fallback
}

function setWaypoint(u: Unicorn, p: { x: number; y: number }) {
  u.wx = p.x;
  u.wy = p.y;
}

// closest visible (past-sprout) flower within notice radius, or none
function nearestFlower(u: Unicorn) {
  let best: Flower | undefined;
  let bestDist = NOTICE_RADIUS;
  for (const b of beds) {
    for (const f of b.flowers) {
      if (f.growth < 0.33) {
        continue;
      }
      const d = Math.hypot(f.x - u.x, f.y - u.y);
      if (d < bestDist) {
        bestDist = d;
        best = f;
      }
    }
  }
  return best;
}

export function scareUnicorns(originX: number, originY: number) {
  for (const u of unicorns) {
    if (u.state === UnicornState.Scared) {
      continue;
    }
    const dx = u.x - originX;
    const dy = u.y - originY;
    // Flee to the nearest edge in the direction away from the noise.
    // Pick the dominant axis to determine which edge to head for.
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    let fleeX: number;
    let fleeY: number;
    if (ax >= ay) {
      // heading for left or right edge — walk straight to it
      fleeX = dx > 0 ? VIEW_W + 30 : -30;
      fleeY = u.y;
    } else {
      // heading for top or bottom edge
      fleeX = u.x;
      fleeY = dy > 0 ? FIELD_BOTTOM + 30 : FIELD_TOP - 30;
    }
    u.state = UnicornState.Scared;
    setWaypoint(u, { x: fleeX, y: fleeY });
    u.target = undefined;
  }
}

export function updateUnicorns(dt: number) {
  spawnTimer -= dt;
  if (spawnTimer <= 0 && unicorns.length < CAP) {
    spawnTimer = SPAWN_EVERY;
    const s = SPAWNS[(Math.random() * SPAWNS.length) | 0];
    unicorns.push({
      x: s.x,
      y: s.y,
      state: UnicornState.Warn,
      timer: WARN_TIME,
      wx: s.x,
      wy: s.y,
      hops: 3 + ((Math.random() * 4) | 0),
      speed: 40,
      legPhase: 0,
    });
  }

  for (let i = unicorns.length - 1; i >= 0; i--) {
    const u = unicorns[i];
    // Damage follows the hooves, not just the noticed target: any flower a
    // unicorn stands on gets trampled, in every state.
    for (const b of beds) {
      for (const f of b.flowers) {
        if (
          f.growth >= 0.33 &&
          Math.hypot(f.x - u.x, f.y - u.y) < TRAMPLE_RADIUS
        ) {
          trample(f);
        }
      }
    }
    if (u.state === UnicornState.Warn) {
      u.timer -= dt;
      if (u.timer <= 0) {
        u.state = UnicornState.Wander;
        setWaypoint(u, openPoint());
      }
      continue;
    }
    if (u.state === UnicornState.Notice) {
      // paused: legPhase doesn't advance, so the unicorn reads as stopped
      u.timer -= dt;
      if (u.timer <= 0) {
        u.state = UnicornState.Target;
        setWaypoint(u, u.target as Flower);
      }
      continue;
    }
    if (u.state === UnicornState.Wander && Math.random() < NOTICE_RATE * dt) {
      const f = nearestFlower(u);
      if (f) {
        u.target = f;
        u.state = UnicornState.Notice;
        u.timer = NOTICE_TIME;
        continue;
      }
    }
    // walk toward the current waypoint
    const dx = u.wx - u.x;
    const dy = u.wy - u.y;
    const dist = Math.hypot(dx, dy);
    const step = u.speed * dt;
    u.legPhase += step * 0.25;
    if (dist <= step) {
      u.x = u.wx;
      u.y = u.wy;
      if (u.state === UnicornState.Leave) {
        unicorns.splice(i, 1);
        continue;
      }
      if (u.state === UnicornState.Scared) {
        // reached the edge — leave the field
        unicorns.splice(i, 1);
        continue;
      }
      if (u.state === UnicornState.Target) {
        // the target flower already died underfoot via the trample check
        // above; just resume wandering
        u.target = undefined;
        u.state = UnicornState.Wander;
      }
      if (u.hops-- > 0) {
        setWaypoint(u, openPoint());
      } else {
        u.state = UnicornState.Leave;
        setWaypoint(u, SPAWNS[(Math.random() * SPAWNS.length) | 0]);
      }
      continue;
    }
    let nx = u.x + (dx / dist) * step;
    let ny = u.y + (dy / dist) * step;
    // beds are hazards from the unicorn's perspective: slide around them,
    // except when charging a target — that's the one time it walks in on purpose
    if (
      u.state !== UnicornState.Target &&
      u.state !== UnicornState.Scared &&
      bedAt(nx, ny, 10)
    ) {
      if (!bedAt(nx, u.y, 10)) {
        ny = u.y;
      } else if (!bedAt(u.x, ny, 10)) {
        nx = u.x;
      }
    }
    u.x = nx;
    u.y = ny;
  }
}

function drawUnicorn(u: Unicorn, time: number) {
  const flip = u.wx < u.x ? -1 : 1;
  ctx.save();
  ctx.translate(u.x, u.y);
  ctx.scale(flip, 1);
  // legs, animated by distance walked
  ctx.strokeStyle = "#e8e0f0";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  for (let l = 0; l < 4; l++) {
    const ox = -9 + l * 6;
    const swing = Math.sin(u.legPhase + l * 1.7) * 4;
    ctx.moveTo(ox, 2);
    ctx.lineTo(ox + swing, 12);
  }
  ctx.stroke();
  // tail
  ctx.strokeStyle = "#e77fd0";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-14, -4);
  ctx.quadraticCurveTo(-20, 0 + Math.sin(time * 3) * 2, -18, 6);
  ctx.stroke();
  // chunky body
  ctx.fillStyle = "#fdf6ff";
  ctx.beginPath();
  ctx.ellipse(0, -2, 14, 9, 0, 0, 7);
  ctx.fill();
  // neck + head
  ctx.beginPath();
  ctx.ellipse(12, -13, 6, 5, -0.5, 0, 7);
  ctx.fill();
  // horn
  ctx.fillStyle = "#ffd54a";
  ctx.beginPath();
  ctx.moveTo(13, -17);
  ctx.lineTo(15, -16);
  ctx.lineTo(18, -24);
  ctx.closePath();
  ctx.fill();
  // mane
  ctx.strokeStyle = "#e77fd0";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(8, -16);
  ctx.quadraticCurveTo(2, -14, 2, -7);
  ctx.stroke();
  // eye
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(14, -14, 1.2, 0, 7);
  ctx.fill();
  ctx.restore();
}

// speech-bubble telegraph: shown above a Notice-state unicorn, with a tiny
// rosette in the noticed flower's hue so the player sees exactly what's at risk
function drawThoughtBubble(u: Unicorn, time: number) {
  const hue = (u.target as Flower).hue;
  const bob = Math.sin(time * 6) * 1;
  const bx = u.x + 14;
  const by = u.y - 30 + bob;
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.strokeStyle = "rgba(120,90,140,.6)";
  ctx.lineWidth = 1;
  for (const [ox, oy, r] of [
    [6, 14, 2],
    [10, 20, 3],
  ] as const) {
    ctx.beginPath();
    ctx.arc(u.x + ox, u.y - oy, r, 0, 7);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(bx, by, 11, 0, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = `hsl(${hue},80%,55%)`;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(bx + Math.cos(a) * 3.5, by + Math.sin(a) * 3.5, 2.4, 0, 7);
    ctx.fill();
  }
  ctx.fillStyle = "#ffd54a";
  ctx.beginPath();
  ctx.arc(bx, by, 1.8, 0, 7);
  ctx.fill();
}

export function drawUnicorns(time: number) {
  for (const u of unicorns) {
    if (u.state === UnicornState.Warn) {
      // edge warning marker where the unicorn is about to enter
      const mx = Math.min(Math.max(u.x, 14), VIEW_W - 14);
      const my = Math.min(Math.max(u.y, FIELD_TOP + 14), FIELD_BOTTOM - 14);
      const pulse = 0.5 + 0.5 * Math.sin(time * 10);
      ctx.fillStyle = `rgba(230,57,70,${0.5 + 0.4 * pulse})`;
      ctx.beginPath();
      ctx.arc(mx, my, 9, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("!", mx, my + 4);
      continue;
    }
    drawUnicorn(u, time);
    if (u.state === UnicornState.Notice) {
      drawThoughtBubble(u, time);
    }
  }
}
