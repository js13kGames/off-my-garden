export const canvas = document.querySelector<HTMLCanvasElement>("canvas")!;
export const ctx = canvas.getContext("2d")!;

// Fixed logical viewport: all game code works in 360×640 portrait coordinates.
// One garden = one screen — no camera, no scrolling.
export const VIEW_W = 360;
export const VIEW_H = 640;

let scale = 1;
let ox = 0;
let oy = 0;

export function resize() {
  const dpr = devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
  ox = (canvas.width - VIEW_W * scale) / 2;
  oy = (canvas.height - VIEW_H * scale) / 2;
}

// Exposed so static art can be baked into an offscreen canvas at device
// resolution — matching the main canvas pixel-for-pixel, no resampling blur.
export function viewTransform() {
  return [scale, ox, oy] as const;
}

// Call at the start of each frame; everything drawn after is in logical units,
// centered and letterboxed on the physical canvas.
export function applyViewTransform() {
  ctx.setTransform(scale, 0, 0, scale, ox, oy);
}

export function toLogical(e: { clientX: number; clientY: number }) {
  const dpr = devicePixelRatio || 1;
  return {
    x: (e.clientX * dpr - ox) / scale,
    y: (e.clientY * dpr - oy) / scale,
  };
}

addEventListener("resize", resize);

resize();
