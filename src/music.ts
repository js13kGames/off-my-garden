// Tiny procedural background loop — a hand-rolled WebAudio sequencer instead
// of a tracker player + song blob, since the player alone (SoundBox/ZzFXM)
// would cost more bytes than this whole file plus its "song".
// One-shot sound effects (below, sfx()) reuse the same note() primitive and
// master gain, so the music mute doubles as the SFX mute for free.

export const enum Track {
  Play,
  Win,
  Lose,
}

const BASE = 220; // A3, semitone 0
const BAR_STEPS = 8;
// [roots (chord progression, in semitones), melody (pentatonic degree per
// step, "." = rest), step duration in seconds, melody waveform, melody gain]
const TRACKS: [number[], string, number, OscillatorType, number][] = [
  [
    [0, 7, 9, 5],
    "4.7.9.7.4.2.0...9.7.9.7.4.7.9...0.2.4.2.0.....7.9.7.4.2.0.2.4.",
    0.27,
    "square",
    0.12,
  ], // Play
  [[0, 5, 7, 4], "0.2.4.7.9.7.4.2.0.2.4.7.9.7.4.2.", 0.14, "square", 0.16], // Win — same register, faster, louder square
  [[0, -2, -4, -2], "0.2.0.....4.2.0.....7.4.2.0.......", 0.5, "sine", 0.16], // Lose — same register, slow, soft sine
];

let track = TRACKS[0];

export function setTrack(t: Track) {
  if (track === TRACKS[t]) {
    return;
  }
  track = TRACKS[t];
  stepI = 0; // restart the new track's pattern from its own top
}

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
  drop = 0, // semitones the pitch falls over dur — the "impact" sweep for a thud
) {
  const osc = ac!.createOscillator();
  const g = ac!.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(BASE * 2 ** (semi / 12), at);
  if (drop) {
    osc.frequency.exponentialRampToValueAtTime(
      BASE * 2 ** ((semi - drop) / 12),
      at + dur,
    );
  }
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

export const enum Sfx {
  Notice,
  Block,
  Stomp,
  Ring,
  Coin,
  Place,
}

// [semitones played in sequence, note duration, waveform, gain, gap between
// notes, pitch-drop for a thud's downward sweep]. Same table shape as TRACKS
// above — one place to tune the whole sound design instead of six
// hand-written functions.
const SFX: [number[], number, OscillatorType, number, number, number?][] = [
  [[5, 9], 0.14, "sine", 0.26, 0.1], // Notice — soft low "hm?", well clear of Coin's bright high blip
  [[-5, -12], 0.16, "square", 0.2, 0.05], // Block — descending thunk
  [[7, -5], 0.12, "sawtooth", 0.4, 0.04, 12], // Stomp — crunch: bright bite into a falling low
  [[19, 12, 5, -2], 0.07, "sawtooth", 0.18, 0.04], // Ring — descending sweep
  [[24, 31], 0.06, "square", 0.24, 0.05], // Coin — fast two-note up
  [[12], 0.06, "triangle", 0.2, 0], // Place — single blip
];

const lastPlayed: number[] = [];

export function sfx(kind: Sfx) {
  if (!ac) {
    return; // no gesture has started the context yet — same guard as updateMusic
  }
  const now = ac.currentTime;
  // One sound per kind per 80 ms. Load-bearing, not polish: the trample check
  // sweeps every flower of every bed each tick, so a unicorn crossing a
  // cluster can flatten two or three in one frame, and a noise ring scares a
  // whole group at once. Without this gate each one stacks its own
  // oscillator into a single clipped blare.
  if (now - (lastPlayed[kind] ?? 0) < 0.08) {
    return;
  }
  lastPlayed[kind] = now;
  const [semis, dur, type, gain, gap, drop] = SFX[kind];
  for (let i = 0; i < semis.length; i++) {
    note(semis[i], now + i * gap, dur, type, gain, drop);
  }
}

export function updateMusic() {
  if (!ac) {
    return;
  }
  const [roots, melody, step, type, gain] = track;
  while (nextTime < ac.currentTime + 0.25) {
    const bar = (stepI / BAR_STEPS) | 0;
    if (stepI % BAR_STEPS === 0) {
      note(
        roots[bar % roots.length] - 12,
        nextTime,
        step * BAR_STEPS * 0.9,
        "triangle",
        0.5,
      );
    }
    const deg = melody[stepI % melody.length];
    if (deg !== ".") {
      const scale = [0, 2, 4, 7, 9];
      note(
        roots[bar % roots.length] + scale[Number(deg) % scale.length] + 12,
        nextTime,
        step * 0.85,
        type,
        gain,
      );
    }
    nextTime += step;
    stepI++;
  }
}
