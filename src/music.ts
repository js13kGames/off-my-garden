// Tiny procedural background loop — a hand-rolled WebAudio sequencer instead
// of a tracker player + song blob, since the player alone (SoundBox/ZzFXM)
// would cost more bytes than this whole file plus its "song".
// ponytail: music only, no SFX and no win/lose variation — add stingers if
// silence on those screens ever bugs someone.

const BASE = 220; // A3, semitone 0
const STEP = 0.27; // ~110 BPM eighth notes
const BAR_STEPS = 8;
// I–V–vi–IV, in semitones over BASE
const ROOTS = [0, 7, 9, 5];
// one pentatonic degree (0,2,4,7,9) per step, "." = rest — 4 bars, loops forever
const MELODY = "4.7.9.7.4.2.0...9.7.9.7.4.7.9...0.2.4.2.0.....7.9.7.4.2.0.2.4.";

let ac: AudioContext | undefined;
let master: GainNode;
let on = true;
let nextTime = 0;
let stepI = 0;

function note(
  semi: number,
  at: number,
  dur: number,
  type: OscillatorType,
  gain: number,
) {
  const osc = ac!.createOscillator();
  const g = ac!.createGain();
  osc.type = type;
  osc.frequency.value = BASE * 2 ** (semi / 12);
  osc.connect(g).connect(master);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, at + dur);
  osc.start(at);
  osc.stop(at + dur);
}

export function startMusic() {
  if (!ac) {
    ac = new AudioContext();
    master = ac.createGain();
    master.gain.value = on ? 0.18 : 0;
    master.connect(ac.destination);
    nextTime = ac.currentTime;
  } else if (ac.state === "suspended") {
    ac.resume();
  }
}

export function musicOn(): boolean {
  return on;
}

export function toggleMusic() {
  on = !on;
  if (master) {
    master.gain.linearRampToValueAtTime(on ? 0.18 : 0, ac!.currentTime + 0.05);
  }
}

export function updateMusic() {
  if (!ac) {
    return;
  }
  while (nextTime < ac.currentTime + 0.25) {
    const bar = (stepI / BAR_STEPS) | 0;
    if (stepI % BAR_STEPS === 0) {
      note(
        ROOTS[bar % ROOTS.length] - 12,
        nextTime,
        STEP * BAR_STEPS * 0.9,
        "triangle",
        0.5,
      );
    }
    const deg = MELODY[stepI % MELODY.length];
    if (deg !== ".") {
      const scale = [0, 2, 4, 7, 9];
      note(
        ROOTS[bar % ROOTS.length] + scale[Number(deg) % scale.length] + 12,
        nextTime,
        STEP * 0.85,
        "square",
        0.12,
      );
    }
    nextTime += STEP;
    stepI++;
  }
}
