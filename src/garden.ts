import { ctx } from "./canvas";

// Playfield strips: HUD above, toolbar below — later tickets fill them in.
export const FIELD_TOP = 40;
export const FIELD_BOTTOM = 580;

export type Flower = {
  x: number;
  y: number;
  growth: number; // 0..1, 1 = mature
  rate: number; // growth per second
  hue: number;
};

export type Bed = {
  x: number;
  y: number;
  w: number;
  h: number;
  flowers: Flower[];
};

// Full regrowth takes ~20 s, with per-flower variance so beds don't pulse in sync
const GROW_TIME = 20;

function makeBed(x: number, y: number, hue: number): Bed {
  const w = 96;
  const h = 66;
  const flowers: Flower[] = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      flowers.push({
        x: x + 20 + c * 28,
        y: y + 20 + r * 28,
        growth: Math.random() * 0.5,
        rate: (0.8 + Math.random() * 0.4) / GROW_TIME,
        hue,
      });
    }
  }
  return { x, y, w, h, flowers };
}

// Asymmetric five-bed arrangement (A–E) with broad open walkways between beds
export const beds: Bed[] = [
  makeBed(28, 66, 340), // A — tulips
  makeBed(236, 66, 50), // B — daisies
  makeBed(132, 258, 315), // C — blossoms
  makeBed(28, 428, 40), // D — sunflowers
  makeBed(236, 462, 275), // E — violets
];

export function updateGarden(dt: number) {
  for (const bed of beds) {
    for (const f of bed.flowers) {
      f.growth = Math.min(1, f.growth + f.rate * dt);
    }
  }
}

function drawFlower(f: Flower, time: number) {
  const g = f.growth;
  ctx.save();
  ctx.translate(f.x, f.y);
  if (g >= 1) {
    // mature: subtle pulsing halo instead of a permanent icon
    const pulse = 0.5 + 0.5 * Math.sin(time * 4 + f.x);
    ctx.fillStyle = `hsla(${f.hue},90%,70%,${0.15 + 0.15 * pulse})`;
    ctx.beginPath();
    ctx.arc(0, -6, 11 + 2 * pulse, 0, 7);
    ctx.fill();
  }
  // stem grows with the flower
  const stem = 4 + 8 * g;
  ctx.strokeStyle = "#2c7a2c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(0, 4 - stem);
  ctx.stroke();
  const top = 4 - stem;
  if (g < 0.33) {
    // sprout: tiny leaf
    ctx.fillStyle = "#3c9a3c";
    ctx.beginPath();
    ctx.arc(0, top, 2, 0, 7);
    ctx.fill();
  } else {
    // bud → bloom: petals scale up with growth
    const size = g < 0.66 ? 2.5 : 3 + 3 * g;
    ctx.fillStyle = `hsl(${f.hue},80%,${g < 0.66 ? 45 : 60}%)`;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(
        Math.cos(a) * size * 0.8,
        top + Math.sin(a) * size * 0.8,
        size * 0.7,
        0,
        7,
      );
      ctx.fill();
    }
    ctx.fillStyle = "#ffd54a";
    ctx.beginPath();
    ctx.arc(0, top, size * 0.5, 0, 7);
    ctx.fill();
  }
  ctx.restore();
}

export function drawGarden(time: number) {
  for (const bed of beds) {
    // soil patch
    ctx.fillStyle = "#6b4a2c";
    ctx.beginPath();
    ctx.roundRect(bed.x, bed.y, bed.w, bed.h, 10);
    ctx.fill();
    ctx.strokeStyle = "#54371f";
    ctx.lineWidth = 3;
    ctx.stroke();
    for (const f of bed.flowers) {
      drawFlower(f, time);
    }
  }
}
