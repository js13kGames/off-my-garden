// 60 Hz fixed step — change TICK_HZ when sim needs it
const TICK_HZ = 60;
const TICK = 1 / TICK_HZ;
const MAX_CATCHUP = 5; // cap catch-up to avoid spiral after tab-switch

export type Step = { dt: number; alpha: number };

export function start(update: (s: Step) => void, render: (s: Step) => void) {
  let last = performance.now(),
    acc = 0;
  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, MAX_CATCHUP * TICK);
    last = now;
    acc += dt;
    requestAnimationFrame(tick);
    while (acc >= TICK) {
      update({ dt: TICK, alpha: 1 });
      acc -= TICK;
    }
    render({ dt, alpha: acc / TICK });
  };
  requestAnimationFrame(tick);
}
