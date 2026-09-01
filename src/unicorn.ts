import { ctx, VIEW_W } from "./canvas";
import { beds, FIELD_BOTTOM, FIELD_TOP, type Flower, trample } from "./garden";
import {
  inRepellent,
  nearestAttractor,
  REPEL_RADIUS,
  repellents,
} from "./placeable";

// module-local: an exported const enum would stop erasing under isolatedModules
const enum UnicornState {
  Warn,
  Wander,
  Notice,
  Target,
  Leave,
  Scared,
  Lured,
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
// Unicorns start turning just before a repellent's edge, so they read as
// avoiding the area rather than bouncing off it
const AVOID_MARGIN = 6;
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
    if (!bedAt(x, y, 16) && !inRepellent(x, y)) {
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
      // flowers under a repellent stop being noticeable — the tool has to
      // protect the bed it covers, not just bend traffic around it
      if (f.growth < 0.33 || inRepellent(f.x, f.y)) {
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
    // Attraction outranks whatever the unicorn was doing — pulling one off a
    // flower it already noticed is the whole point of the tool. Re-checked
    // every frame, so the waypoint tracks the lure and the linger is free:
    // once there, the unicorn is already standing on its waypoint each tick.
    if (
      u.state !== UnicornState.Warn &&
      u.state !== UnicornState.Leave &&
      u.state !== UnicornState.Scared
    ) {
      const lure = nearestAttractor(u.x, u.y);
      if (lure) {
        u.state = UnicornState.Lured;
        u.target = undefined;
        setWaypoint(u, lure);
      } else if (u.state === UnicornState.Lured) {
        // the lure expired — back to ordinary wandering
        u.state = UnicornState.Wander;
        setWaypoint(u, openPoint());
      }
    }
    // A repellent dropped on a unicorn's plans invalidates them: a covered
    // flower is abandoned and a covered waypoint is re-picked, so nobody
    // orbits a radius forever chasing something it can no longer reach.
    // Leaving unicorns keep their edge waypoint — that one means "despawn",
    // and lured ones keep the gem so the two tools don't fight over a frame.
    if (
      u.state !== UnicornState.Scared &&
      u.state !== UnicornState.Leave &&
      u.state !== UnicornState.Lured
    ) {
      if (u.target && inRepellent(u.target.x, u.target.y)) {
        u.target = undefined;
        u.state = UnicornState.Wander;
        setWaypoint(u, openPoint());
      } else if (inRepellent(u.wx, u.wy)) {
        setWaypoint(u, openPoint());
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
      if (u.state === UnicornState.Lured) {
        // stand at the lure until it expires — no hops spent, no exit
        continue;
      }
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
    let dirx = dx / dist;
    let diry = dy / dist;
    // Repellents are skirted, not butted into: a heading that points into the
    // area is swapped for the tangent that carries the unicorn around the rim,
    // and a repellent dropped on top of one pushes it back out.
    // ponytail: no lookahead, so a waypoint right behind a radius is reached
    // the long way round — swap in real path steering if that ever reads badly.
    if (u.state !== UnicornState.Scared) {
      for (const p of repellents) {
        const ox = u.x - p.x;
        const oy = u.y - p.y;
        const d = Math.hypot(ox, oy) || 1;
        if (d > REPEL_RADIUS + AVOID_MARGIN) {
          continue;
        }
        const rx = ox / d;
        const ry = oy / d;
        if (dirx * rx + diry * ry < 0) {
          // pass on the side the unicorn already leans toward; a dead-on
          // approach ties, and the tie picks a side rather than stalling
          const side = rx * diry - ry * dirx >= 0 ? 1 : -1;
          dirx = -ry * side;
          diry = rx * side;
        }
        if (d < REPEL_RADIUS) {
          dirx += rx;
          diry += ry;
        }
      }
      const m = Math.hypot(dirx, diry) || 1;
      dirx /= m;
      diry /= m;
    }
    let nx = u.x + dirx * step;
    let ny = u.y + diry * step;
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

// The sprite is copied verbatim out of the Inkscape drawing (layout/drawing.svg,
// "Horses" layer). Path2D parses SVG path data, so redrawing the unicorn there
// is a copy-paste of the new `d` attributes instead of hand-translated curves —
// only the precision was trimmed to 1 decimal, about a tenth of a pixel.
// Coordinates stay in the drawing's own space; the transform in drawUnicorn
// maps them onto the sprite origin, so nothing had to be re-based by hand.
const TAIL = new Path2D(
  "m93.8,185.6c-1.3,-0.2-1.4,-1-1.5,-2.4 1.3,1.7 1.5,-1.6 2.6,-1.7 1.1,0 1.7,0.3 2.1,1.4-1.8,-0.1-1.8,2.8-3.2,2.7z",
);
const BODY = new Path2D(
  "m103.4,184.1c0,1.6-0.3,3-4.3,2-1.9,-0.5-3.1,0-3.7,-0.4-0.5,-0.3-0.4,-0.5-0.3,-1.6 0,-1.5 1.8,-2.7 4.1,-2.7 2.3,0 4.2,1.2 4.2,2.7z",
);
const EAR_BACK = new Path2D(
  "m104.7,175.5c0.8,0 0.1,1.3 0.5,2.6l-1.7,0.2c0,-1.4 0.6,-2.8 1.2,-2.8z",
);
const MANE = new Path2D(
  "m105.1,176.4c0.5,0 0.3,1.2 0.8,1.5 0.3,0.2 0.6,0.2 1.4,-0.6 0.1,0.6-0.6,1.6-0.9,2-1,1.4-3.6,2.8-6.2,3-0.4,0.1-1,0.7-2.3,0.4 0.2,-0.1 0.6,-0.5 0.6,-0.6-1.3,-0.1-0.8,-1.9-0.9,-2.2 1.5,1.7 2.1,-1 0.8,-1.7 1.6,-0.3 1.4,-1.7 3.3,-2.1 1.7,-0.3 3.1,0.3 3.4,0.3z",
);
const HEAD = new Path2D(
  "m107.6,181.4c0.1,1.5-0.6,2-1.4,1.9-0.8,0-1.4,-0.8-1.7,-0.8-0.3,0-0.7,0-1,-0.1-0.2,0-1.1,1.3-2,0.3-1.1,-1 0,-1.4-0.4,-1.9-0.3,-0.6-0.4,-1.3-0.1,-1.8 0.5,-1.1 2.1,-1.5 3.5,-0.8 1,0.4 1.6,1.1 1.9,1.9 0.1,0.4 1.1,0.1 1.2,1.3z",
);
const EAR_FRONT = new Path2D(
  "m103.1,175.3c0.8,0 0.1,1.4 0.5,2.6l-1.7,0.2c0,-1.3 0.6,-2.8 1.2,-2.8z",
);
const HORN = new Path2D(
  "m107.2,175.1c0.3,0.2-0.4,1.5-1.4,2.7-0.6,0.1-1.1,0-1.2,-0.7 0.7,-1 2.3,-2.3 2.6,-2z",
);
const MUZZLE = new Path2D(
  "m107.3,182.6c-0.3,0.6-1,0.7-1.3,0.6-0.4,-0.1-0.2,-0.5 0.3,-1.2 0.6,-0.7 0.7,-0.8 1,-0.6 0.3,0.1 0.2,0.9 0,1.2z",
);

// The art measures 15.3x13.9 drawing units; 2.2 lands it at ~34x31 px, the
// footprint the old primitive sprite had, so bed spacing, the trample radius
// and the thought bubble all still read right.
const SPRITE_SCALE = 2.2;
const ANCHOR_X = 99.9;
// chosen so the hooves land 12 px below the unicorn's logical position
const ANCHOR_Y = 183.24;

// [hip x, hip y, rest angle, stride phase]. The rest angle is the splay the
// drawing baked in as a skew — hind legs back, front legs forward — and the
// swing rides on top of it. Diagonal pairs share a phase, so it reads as a trot.
const FAR_LEGS: number[][] = [
  [98.08, 185, 0.25, 3.14],
  [102.63, 185, -0.25, 0],
];
const NEAR_LEGS: number[][] = [
  [96.12, 185.35, 0.25, 0],
  [101.08, 185.51, -0.25, 3.14],
];

function drawLegs(legs: number[][], color: string, phase: number) {
  for (const [x, y, rest, offset] of legs) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rest + Math.sin(phase + offset) * 0.3);
    ctx.fillStyle = color;
    ctx.fillRect(-0.63, 0, 1.26, 3.8);
    // hoof: the leg's own bottom slice, so it swings with the leg for free
    ctx.fillStyle = "#000";
    ctx.fillRect(-0.63, 3.1, 1.26, 0.7);
    ctx.restore();
  }
}

// swings everything drawn after it about a point in sprite coordinates
function pivot(x: number, y: number, angle: number) {
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.translate(-x, -y);
}

function dot(x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.fill();
}

function drawUnicorn(u: Unicorn, time: number) {
  const flip = u.wx < u.x ? -1 : 1;
  ctx.save();
  ctx.translate(u.x, u.y);
  ctx.scale(flip * SPRITE_SCALE, SPRITE_SCALE);
  ctx.translate(-ANCHOR_X, -ANCHOR_Y);
  ctx.fillStyle = "rgba(0,0,0,.07)";
  ctx.beginPath();
  ctx.ellipse(98.97, 189.37, 6.77, 2.21, 0, 0, 7);
  ctx.fill();
  // the far pair is greyed so the near pair reads as the closer legs
  drawLegs(FAR_LEGS, "#ccc", u.legPhase);
  // Tail and head ride on wall time rather than legPhase: a unicorn stopped at
  // a lure, or frozen mid-telegraph, keeps moving enough to read as alive.
  ctx.save();
  pivot(96.9, 182.8, Math.sin(time * 3) * 0.15);
  ctx.fillStyle = "#00f";
  ctx.fill(TAIL);
  ctx.restore();
  ctx.fillStyle = "#fff";
  ctx.fill(BODY);
  // head nods about the neck joint; the mane rides along, and since it sits on
  // top of the white body the sub-pixel shift can't open a seam
  ctx.save();
  pivot(101.5, 182.5, Math.sin(time * 2) * 0.04);
  ctx.fill(EAR_BACK); // the far ear, behind the mane
  ctx.fillStyle = "#00f";
  ctx.fill(MANE);
  ctx.fillStyle = "#fff";
  ctx.fill(HEAD);
  ctx.fill(EAR_FRONT);
  ctx.fillStyle = "#ffd54a";
  ctx.fill(HORN);
  ctx.fillStyle = "#f0d5a7";
  ctx.fill(MUZZLE);
  ctx.fillStyle = "#000";
  dot(104.6, 179.89, 0.33); // eye
  dot(106.64, 181.7, 0.31); // nostril
  // two grooves across the horn, the drawing's shorthand for its twist
  ctx.fillStyle = "rgba(0,0,0,.39)";
  for (const [x, y, rx, ry] of [
    [105.56, 176.98, 0.66, 0.13],
    [106.22, 176.22, 0.53, 0.1],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0.56, 0, 7);
    ctx.fill();
  }
  ctx.restore();
  drawLegs(NEAR_LEGS, "#fff", u.legPhase);
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
