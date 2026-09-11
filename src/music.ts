// Tiny procedural background loop — a hand-rolled WebAudio sequencer instead
// of a tracker player + song blob, since the player alone (SoundBox/ZzFXM)
// would cost more bytes than this whole file plus its "song".
// ponytail: music only, no SFX — the win/lose stingers are just alternate
// rows in TRACKS (roots/melody/tempo/waveform/gain), not a second engine.

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
