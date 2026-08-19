export const canvas = document.querySelector<HTMLCanvasElement>("canvas")!;
export const ctx = canvas.getContext("2d")!;

export function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}

addEventListener("resize", resize);

resize();
