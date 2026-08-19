import { ctx, VIEW_W } from "./canvas";
import { beds, FIELD_BOTTOM, FIELD_TOP } from "./garden";

export type Unicorn = {
  x: number;
  y: number;
  state: "warn" | "wander" | "leave";
  timer: number;
  wx: number; // current waypoint
  wy: number;
  hops: number; // wander waypoints left before heading for an exit
  speed: number;
  legPhase: number;
};

export const unicorns: Unicorn[] = [];

// Early game: only a few unicorns at once (waves escalate this later)
const CAP = 3;
const WARN_TIME = 1.2;
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

export function updateUnicorns(dt: number) {
  spawnTimer -= dt;
  if (spawnTimer <= 0 && unicorns.length < CAP) {
    spawnTimer = SPAWN_EVERY;
    const s = SPAWNS[(Math.random() * SPAWNS.length) | 0];
    unicorns.push({
      x: s.x,
      y: s.y,
      state: "warn",
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
    if (u.state === "warn") {
      u.timer -= dt;
      if (u.timer <= 0) {
        u.state = "wander";
        setWaypoint(u, openPoint());
      }
      continue;
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
      if (u.state === "leave") {
        unicorns.splice(i, 1);
      } else if (u.hops-- > 0) {
        setWaypoint(u, openPoint());
      } else {
        u.state = "leave";
        setWaypoint(u, SPAWNS[(Math.random() * SPAWNS.length) | 0]);
      }
      continue;
    }
    let nx = u.x + (dx / dist) * step;
    let ny = u.y + (dy / dist) * step;
    // beds are hazards from the unicorn's perspective: slide around them
    if (u.state === "wander" && bedAt(nx, ny, 10)) {
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

export function drawUnicorns(time: number) {
  for (const u of unicorns) {
    if (u.state === "warn") {
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
  }
}
