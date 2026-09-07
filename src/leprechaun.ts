import { ctx } from "./canvas";
import { FIELD_BOTTOM, FIELD_TOP } from "./garden";

// He is a character, not a cursor: crossing the whole garden takes ~5 s.
const SPEED = 110;

// Free, always-on counterplay for round one when no tool is bought yet — but
// weaker than a repellent, so it stays a detour rather than a wall.
export const LEP_RADIUS = 32;

export const lep = {
  x: 180,
  y: 400,
  tx: 180,
  ty: 400,
  moving: false,
  // set each frame by updateUnicorns; drives the ring below so it only shows
  // up on the frames it's actually doing something
  blocking: false,
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

// The sprite is copied verbatim out of the Inkscape drawing (layout/lep.svg),
// the same way the unicorn was ported from layout/drawing.svg: Path2D parses
// SVG path data directly, so redrawing him here is a copy-paste of the `d`
// attributes instead of hand-translated curves — only the precision was
// trimmed to 1 decimal. Coordinates stay in the drawing's own space; the
// transform in drawLep maps them onto the sprite's foot origin.
const BACK_SHOE = new Path2D(
  "m 33.7,74 c 0.3,-0.1 0.8,0.3 1.2,0.7 -0.1,0.1 -0.1,0.4 0,0.6 0.3,0.4 0.7,0.4 1,0.5 -0.6,1 -1.6,1.2 -3.5,-0.3 0.1,-0.7 0.7,-1.3 1.2,-1.5 z",
);
const FRONT_SHOE = new Path2D(
  "m 37.8,74.4 c 0.2,-0.3 0.8,-0.3 1.4,-0.2 0,0.1 0.2,0.3 0.4,0.5 0.5,0.1 0.8,-0.1 1.1,-0.3 0.1,1.1 -0.5,1.9 -2.9,2 -0.4,-0.7 -0.3,-1.4 0,-2 z",
);
const COAT = new Path2D(
  "m 41,70.5 c -0.4,-0.2 -1.4,-0.1 -1.6,0.4 0.2,1.2 0.1,2.3 -0.1,3.4 -0.5,-0.1 -0.8,-0.3 -1.5,0.1 -0.2,-0.5 -0.9,-0.9 -1,-1.5 -0.1,0.6 -1.6,1.6 -1.8,2 -0.5,-0.7 -0.6,-0.9 -1.5,-0.8 -0.1,-0.6 0,-1.3 0.5,-2.1 -0.7,-0.5 -1.3,-0.8 -1.9,-0.4 0.2,-1.2 1.1,-3.9 4.7,-3.5 3.6,0.3 2.2,0.2 4.3,2.5 z",
);
const BELT = new Path2D(
  "m 34.3,70.9 c 0,-0.4 0.2,-1.5 0.2,0 l 4.9,-0.1 v 1.1 h -5.4 c 0.2,-0.3 0.3,-0.7 0.4,-1 z",
);
const FACE = new Path2D(
  "m 34.7,61.3 h 5.8 c -0.3,1.7 -0.8,3.5 -0.2,5.2 l -5.6,0 z",
);
const BEARD = new Path2D(
  "m 32.8,63.3 3.1,-0.1 c -0.6,0.7 -1.2,1.3 -0.8,1.9 1.2,0.4 1.1,1 1.4,1.4 0.4,-0.6 1,-0.8 1.8,-0.3 0.6,-0.8 1.1,-0.6 1.7,-0.5 0.3,0.8 0.2,1.3 -0.2,1.5 -0.2,0.8 -0.7,1.1 -1.4,1 -0.4,0.4 -1.4,0.9 -2.4,0.1 -0.9,0.3 -1.5,-0.5 -2,-1.3 -0.8,0.3 -1.2,0.1 -1.5,-0.2 -0.8,-0.5 -0.2,-0.7 -0.4,-1.1 -0.5,-0.8 0.4,-1.8 0.6,-2.4 z",
);
// hat pieces stay in the group's own coordinate space; drawLep applies the
// group's transform once before filling them
const HAT = new Path2D(
  "m 71.6,91.5 c 3.2,-2.2 5.3,-2.3 8.1,-0.9 1.3,1.3 1.1,2.7 0.7,4.1 0.4,0.7 3,-1.8 2.8,0.7 -0.2,0.8 -0.1,1.8 -2,2.2 -3.8,0.1 -6.4,0.3 -10,1.3 -0.8,-0.4 -2.1,-0.3 -2.4,-1.7 -0.8,-2.5 1.3,-0.1 2.6,-1.4 0.6,-1.6 -0.4,-3.7 0.2,-4.3 z",
);
const HAT_SHADE = new Path2D(
  "m 71.7,91.7 c 1,-0.4 2.9,1 1.8,3.9 -0.1,0.2 6.8,-2.1 6.8,-0.8 0,0.9 -7.4,2.2 -7.6,2.4 -0.4,0.6 -0.8,0.9 -1.6,1.6 -1,-0.3 -1.7,-0.5 -2.4,-1.5 -0.8,-1.9 1.5,-0.3 2.6,-1.4 0.9,-1.5 -0.2,-3.8 0.3,-4.1 z",
);
const HAT_BAND = new Path2D(
  "m 80.7,92.9 c 0,0.6 -0.1,1.3 -0.2,1.9 -1.6,0.5 -5,1.1 -9,1.1 -0.4,-0.4 0.1,-1.2 -0.1,-1.7 4,-0.3 6.3,-0.2 9.4,-1.4 z",
);

// The art measures ~12x19.7 drawing units; 1.92 lands it at ~23x37 px — 20%
// bigger than the old primitive sprite's ~19x31 footprint, for readability.
const SPRITE_SCALE = 1.92;
const ANCHOR_X = 36.6; // midpoint of the two shoes
const ANCHOR_Y = 76.4; // shoe bottoms, so his feet stay on lep.x/lep.y

// ponytail: circular stand-in for the drawing's elliptical coat vignette —
// close enough at 19 px wide to keep the coat from reading flat.
const COAT_SHADE = ctx.createRadialGradient(36.5, 71.4, 0, 36.5, 71.4, 4.5);
COAT_SHADE.addColorStop(0, "rgba(0,0,0,0)");
COAT_SHADE.addColorStop(0.89, "rgba(0,0,0,.13)");
COAT_SHADE.addColorStop(1, "rgba(0,0,0,.34)");

export function drawLep(time: number) {
  if (lep.blocking) {
    // the deflection ring: shown only while it's bending a path, so it reads
    // as feedback rather than a permanent radius like the placeables have
    ctx.strokeStyle = "rgba(255,255,255,.15)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(lep.x, lep.y, LEP_RADIUS, 0, 7);
    ctx.stroke();
  }
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
  ctx.scale(flip * SPRITE_SCALE, SPRITE_SCALE);
  ctx.translate(-ANCHOR_X, -ANCHOR_Y);
  // ground shadow, same convention as the unicorn's
  ctx.fillStyle = "rgba(0,0,0,.07)";
  ctx.beginPath();
  ctx.ellipse(ANCHOR_X, ANCHOR_Y + 0.5, 6, 1.9, 0, 0, 7);
  ctx.fill();
  // shoes swing opposite each other, each nudged in its own local space so
  // they don't drag the coat along with them
  const step = lep.moving ? Math.sin(time * 14) * 1.2 : 0;
  ctx.fillStyle = "#a3460e";
  ctx.strokeStyle = "#03160c";
  ctx.lineWidth = 0.4;
  ctx.save();
  ctx.translate(-step, 0);
  ctx.fill(BACK_SHOE);
  ctx.stroke(BACK_SHOE);
  ctx.restore();
  ctx.save();
  ctx.translate(step, 0);
  ctx.fill(FRONT_SHOE);
  ctx.stroke(FRONT_SHOE);
  ctx.restore();
  // hands
  ctx.fillStyle = "#fdc798";
  ctx.strokeStyle = "#f29a63";
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.ellipse(40.4, 71.3, 0.9, 0.7, 0, 0, 7);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(32.6, 72.1, 0.8, 0.7, 0, 0, 7);
  ctx.fill();
  ctx.stroke();
  // coat
  ctx.fillStyle = "#1c8f1e";
  ctx.strokeStyle = "#03160c";
  ctx.lineWidth = 0.2;
  ctx.fill(COAT);
  ctx.stroke(COAT);
  ctx.fillStyle = COAT_SHADE;
  ctx.fill(COAT);
  // belt
  ctx.fillStyle = "#03160c";
  ctx.fill(BELT);
  ctx.save();
  ctx.transform(1, -0.01, -0.08, 1, 0, 0);
  ctx.fillStyle = "#1d1e1c";
  ctx.strokeStyle = "#f5c604";
  ctx.lineWidth = 0.5;
  ctx.fillRect(41.6, 71.3, 1.7, 1.6);
  ctx.strokeRect(41.6, 71.3, 1.7, 1.6);
  ctx.restore();
  // face and beard
  ctx.fillStyle = "#fec799";
  ctx.fill(FACE);
  ctx.fillStyle = "#fe7014";
  ctx.strokeStyle = "#db3b01";
  ctx.lineWidth = 0.2;
  ctx.fill(BEARD);
  ctx.stroke(BEARD);
  // hat, drawn in its own slightly-skewed group space
  ctx.save();
  ctx.transform(0.82, 0, 0, 0.82, -25.73, -16.92);
  ctx.fillStyle = "#1d921a";
  ctx.strokeStyle = "#042112";
  ctx.lineWidth = 0.24;
  ctx.fill(HAT);
  ctx.stroke(HAT);
  ctx.fillStyle = "rgba(0,0,0,.11)";
  ctx.fill(HAT_SHADE);
  ctx.fillStyle = "#1d1e22";
  ctx.fill(HAT_BAND);
  ctx.save();
  ctx.transform(1, -0.08, 0.02, 1, 0, 0);
  ctx.fillStyle = "#1d1e1c";
  ctx.strokeStyle = "#f5c604";
  ctx.lineWidth = 0.73;
  ctx.fillRect(73.4, 99.8, 2.3, 2.2);
  ctx.strokeRect(73.4, 99.8, 2.3, 2.2);
  ctx.restore();
  ctx.restore();
  // ear and eyes sit on top: the hat brim overlaps the top of the face, so
  // these have to come after it to stay visible
  ctx.fillStyle = "#fec799";
  ctx.fillRect(33.1, 64.7, 0.7, 1.2);
  ctx.fillStyle = "#0c0b08";
  ctx.fillRect(37.2, 63.7, 0.7, 1.4);
  ctx.fillRect(38.8, 63.5, 0.7, 1.4);
  ctx.restore();
}
