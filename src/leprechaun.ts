import { ctx } from "./canvas";
import { FIELD_BOTTOM, FIELD_TOP } from "./garden";

// He is a character, not a cursor: crossing the whole garden takes ~5 s.
const SPEED = 110;

export const lep = {
  x: 180,
  y: 400,
  tx: 180,
  ty: 400,
  moving: false,
};

export function sendLepTo(x: number, y: number) {
  lep.tx = x;
  lep.ty = Math.min(Math.max(y, FIELD_TOP + 12), FIELD_BOTTOM - 8);
  lep.moving = true;
}

export function updateLep(dt: number) {
  if (!lep.moving) {
    return;
  }
  const dx = lep.tx - lep.x;
  const dy = lep.ty - lep.y;
  const dist = Math.hypot(dx, dy);
  const step = SPEED * dt;
  if (dist <= step) {
    lep.x = lep.tx;
    lep.y = lep.ty;
    lep.moving = false;
    return;
  }
  lep.x += (dx / dist) * step;
  lep.y += (dy / dist) * step;
}

export function drawLep(time: number) {
  if (lep.moving) {
    // destination marker
    ctx.strokeStyle = "rgba(255,255,255,.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(lep.tx, lep.ty, 5 + 2 * Math.sin(time * 6), 0, 7);
    ctx.stroke();
  }
  const bob = lep.moving ? Math.sin(time * 14) * 2 : 0;
  const flip = lep.moving && lep.tx < lep.x ? -1 : 1;
  ctx.save();
  ctx.translate(lep.x, lep.y + bob);
  ctx.scale(flip, 1);
  // legs
  const step = lep.moving ? Math.sin(time * 14) * 3 : 0;
  ctx.strokeStyle = "#4a2f1a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-2, -6);
  ctx.lineTo(-2 - step, 0);
  ctx.moveTo(2, -6);
  ctx.lineTo(2 + step, 0);
  ctx.stroke();
  // body
  ctx.fillStyle = "#1f8a3d";
  ctx.beginPath();
  ctx.roundRect(-5, -16, 10, 11, 3);
  ctx.fill();
  // beard
  ctx.fillStyle = "#d96a1f";
  ctx.beginPath();
  ctx.arc(0, -17, 4.5, 0, Math.PI);
  ctx.fill();
  // head
  ctx.fillStyle = "#f2c9a0";
  ctx.beginPath();
  ctx.arc(0, -20, 4, 0, 7);
  ctx.fill();
  // eye
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(1.5, -21, 0.8, 0, 7);
  ctx.fill();
  // hat
  ctx.fillStyle = "#146b2e";
  ctx.fillRect(-6, -25, 12, 2);
  ctx.fillRect(-4, -31, 8, 6);
  ctx.fillStyle = "#ffd54a";
  ctx.fillRect(-4, -27, 8, 1.5);
  ctx.restore();
}
