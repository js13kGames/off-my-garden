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
const VOLUME = 0.65; // master bus — music and SFX share it, so this is the whole mix
const BAR_STEPS = 8;
// [roots (chord progression, in semitones), melody (scale degree per step,
// "." = rest), step duration in seconds, melody waveform, melody gain,
// scale (semitones per degree — carries the octave too, so a track picks its
// own register: Play riffs down at BASE, Win/Lose sing an octave up),
// swing (fraction of a step the off-beats are pushed late — 0 is straight),
// drums (one char per step: "k" kick, "s" snare, "." neither — hats ride every
// step regardless, so only the kit's backbone needs spelling out; "" = no kit.
// The Play kit reads "tum tcs ··· tum tum tcs ···" and runs two bars, not one:
// each phrase gets a bar of its own, and the silence after it is as much of
// the figure as the hits are. Cramming both into one bar loses the shove.)]
const TRACKS: [
  number[],
  string,
  number,
  OscillatorType,
  number,
  number[],
  number,
  string,
][] = [
  // Play — 70s hard-rock riff. Everything here is idiom rather than melody:
  // blues scale (the b5 at degree 3 is the whole flavour) low at BASE, a
  // shuffle so the off-beats drag, and call-and-answer phrasing — two bars
  // that ask, two that reply — instead of unbroken eighths. Root pedal under
  // it, the figure transposing with each chord. G minor: the roots sit two
  // semitones below BASE. Sawtooth for grit a square can't give down here.
  [
    [-2, -2, 1, 3],
    "0.0.1.2.3210....0.0.1.2.5.4.2.0.",
    0.18,
    "sawtooth",
    0.17,
    [0, 3, 5, 6, 7, 10],
    0.22,
    "k.s.....k.k.s...",
  ],
  // Win — a bugle fanfare, not a scale run. Full major scale instead of the
  // pentatonic so the melody can climb in triads, four bars of I-IV-V-I each
  // with its own phrase (ask, answer, lift, land home) instead of one shape
  // repeated under changing chords — that repetition was the boring part.
  // Kit and a little swing carry the celebration the lead alone can't.
  [
    [0, 5, 7, 0],
    "0.2.4.7.7.4.2.4.4.5.7.5.7.4.2.0.",
    0.13,
    "square",
    0.17,
    [12, 14, 16, 17, 19, 21, 23, 24],
    0.12,
    "k.s.k.s.k.s.ksss",
  ],
  // Lose — same register as Win, slow and soft
  [
    [0, -2, -4, -2],
    "0.2.0.....4.2.0.....7.4.2.0.......",
    0.5,
    "sine",
    0.16,
    [12, 14, 16, 19, 21],
    0,
    "",
  ],
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
// Sequencer gate, separate from the context: resetRun stops the music but the
// context must stay alive for SFX, and the next tap (startMusic) brings it back.
let playing = false;
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

let noiseBuf: AudioBuffer | undefined;

// The kit's snare and hats: filtered white noise with a fast decay. One second
// of noise generated once and looped, since a fresh buffer per hit would burn
// CPU for a sound nobody can tell apart from the reused one.
function hit(at: number, dur: number, gain: number, cutoff: number) {
  if (!noiseBuf) {
    noiseBuf = ac!.createBuffer(1, ac!.sampleRate, ac!.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  const src = ac!.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  // Highpass is what separates the two: low cutoff leaves the body that reads
  // as a snare, high cutoff strips everything but the sizzle of a hat.
  const filter = ac!.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = cutoff;
  const g = ac!.createGain();
  src.connect(filter).connect(g).connect(master);
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + dur);
  src.start(at);
  src.stop(at + dur);
}

export function startMusic() {
  playing = true;
  if (!ac) {
    ac = new AudioContext();
    master = ac.createGain();
    master.connect(ac.destination);
    nextTime = ac.currentTime;
  }
  // Mobile hands back a suspended context whenever the gesture isn't credited
  // at construction time, and iOS doesn't reliably report that in `.state` —
  // so resume on every tap (a no-op once running) and re-assert the gain,
  // which a graph built before the unlock can come back up without.
  ac.resume();
  master.gain.value = on ? VOLUME : 0;
}

// A hidden tab throttles rAF to about 1 Hz, so the sequencer would wake once a
// second and schedule only its 0.25 s lookahead — music in stuttering bursts.
// Parking the whole context instead freezes currentTime with it, so the
// pattern picks up exactly where it left off.
addEventListener("visibilitychange", () => {
  if (ac) {
    document.hidden ? ac.suspend() : ac.resume();
  }
});

export function stopMusic() {
  playing = false;
}

export function musicOn(): boolean {
  return on;
}

export function toggleMusic() {
  on = !on;
  if (master) {
    master.gain.linearRampToValueAtTime(
      on ? VOLUME : 0,
      ac!.currentTime + 0.05,
    );
  }
}

export const enum Sfx {
  Notice,
  Block,
  Stomp,
  Ring,
  Coin,
  Place,
  Water,
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
  [[0, 7], 0.09, "triangle", 0.18, 0.06], // Water — soft rising pour, the gentle inverse of Ring
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
  // A suspended context freezes currentTime, so scheduling into one just piles
  // up notes that all fire at once the moment it unlocks.
  if (!ac || !playing || ac.state !== "running") {
    return;
  }
  const [roots, melody, step, type, gain, scale, swing, drums] = track;
  // A clock gap (tab suspend, breakpoint, stubbed clock) would otherwise make
  // this loop schedule every missed step in the past — thousands of nodes for
  // history nobody can hear. More than one lookahead behind → drop the
  // backlog and resume from now.
  if (nextTime < ac.currentTime - 0.25) {
    nextTime = ac.currentTime + 0.05;
  }
  while (nextTime < ac.currentTime + 0.25) {
    const bar = (stepI / BAR_STEPS) | 0;
    if (drums) {
      const beat = drums[stepI % drums.length];
      if (beat === "k") {
        // Kick — a low sine whose pitch collapses an octave and a half in
        // 120 ms. That drop is the whole trick: it reads as a struck skin
        // rather than a bass note.
        note(-24, nextTime, 0.12, "sine", 0.34, 18);
      } else if (beat === "s") {
        hit(nextTime, 0.16, 0.15, 1200);
      }
      // Hats ride every step and swing with the riff, so the shuffle is felt
      // and not just heard in the melody. Kick and snare stay on the grid.
      hit(nextTime + (stepI % 2 ? step * swing : 0), 0.04, 0.045, 8000);
    }
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
      // Off-beats land late by `swing` — the shuffle that separates a rock
      // riff from a drum machine. The bass pedal above stays dead on the beat.
      note(
        roots[bar % roots.length] + scale[Number(deg) % scale.length],
        nextTime + (stepI % 2 ? step * swing : 0),
        step * 0.85,
        type,
        gain,
      );
    }
    nextTime += step;
    stepI++;
  }
}
