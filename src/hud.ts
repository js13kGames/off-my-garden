import { ctx, VIEW_W } from "./canvas";

// Coins are the POC's score — nothing to spend them on yet.
let coins = 0;
const COIN_VALUE = 5;

type Popup = { x: number; y: number; t: number };
const POP_TIME = 0.9;
const pops: Popup[] = [];

export function addCoins(x: number, y: number) {
  coins += COIN_VALUE;
  pops.push({ x, y, t: POP_TIME });
}

export function updateHud(dt: number) {
  for (let i = pops.length - 1; i >= 0; i--) {
    pops[i].t -= dt;
    if (pops[i].t <= 0) {
      pops.splice(i, 1);
    }
  }
}

export function drawHud(wave: number) {
  ctx.textAlign = "left";
  ctx.font = "bold 16px sans-serif";
  ctx.fillStyle = "#ffd54a";
  ctx.fillText(`\u{1F4B0} ${coins}`, 10, 26);

  ctx.textAlign = "right";
  ctx.fillStyle = "#fff";
  ctx.fillText(`Wave ${wave}`, VIEW_W - 10, 26);

  ctx.textAlign = "center";
  ctx.font = "bold 13px sans-serif";
  for (const p of pops) {
    const k = p.t / POP_TIME;
    const y = p.y - 18 * (1 - k);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(0,0,0,${0.6 * k})`;
    ctx.strokeText(`+${COIN_VALUE}`, p.x, y);
    ctx.fillStyle = `rgba(255,213,74,${k})`;
    ctx.fillText(`+${COIN_VALUE}`, p.x, y);
  }
}
