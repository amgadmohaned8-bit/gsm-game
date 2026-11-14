"use client";

/**
 * GSM background music, played live with the Web Audio API (no audio files).
 * A slow, warm "stadium evening" loop in A minor: a soft pad, a deep bass note,
 * a gentle plucked arpeggio with a little echo and a quiet heartbeat.
 * It starts after the first tap, fades out during a match (the crowd takes over)
 * and stops when the app goes to the background.
 */

type Level = "low" | "mid" | "high";
const GAIN: Record<Level, number> = { low: 0.15, mid: 0.28, high: 0.45 };

const BPM = 68;
const EIGHTH = 60 / BPM / 2;
const STEPS = 16; // two bars of 4/4 per chord

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

type Chord = { notes: number[]; bass: number };
const Am: Chord = { notes: [57, 60, 64], bass: 45 };
const F: Chord = { notes: [53, 57, 60], bass: 41 };
const C: Chord = { notes: [55, 60, 64], bass: 48 };
const G: Chord = { notes: [55, 59, 62], bass: 43 };
const Em: Chord = { notes: [55, 59, 64], bass: 40 };
const Dm: Chord = { notes: [53, 57, 62], bass: 38 };
const E: Chord = { notes: [52, 56, 59], bass: 40 };
const PROGRESSIONS: Chord[][] = [
  [Am, F, C, G],
  [Am, G, F, E],
  [F, C, G, Am],
  [Am, Dm, F, E],
  [Am, Em, F, G],
];
// which chord tone the arpeggio plays on each eighth note (-1 rests, 3 = the octave)
const ARP: number[][] = [
  [0, -1, 2, -1, 1, -1, 2, -1, 0, -1, 2, -1, 3, -1, 2, 1],
  [0, -1, 1, 2, -1, 1, 2, -1, 0, -1, 1, 2, 3, -1, 2, -1],
];

let ctx: AudioContext | null = null;
let bus: GainNode | null = null; // music volume
let send: GainNode | null = null; // into the echo
let timer: ReturnType<typeof setInterval> | null = null;
let enabled = true;
let level: Level = "mid";
let unlocked = false;
let ducked = false;
let hidden = false;
let step = 0;
let next = 0;
let progression = PROGRESSIONS[0];
let chordIndex = 0;
let arp = ARP[0];

const lite = () => typeof document !== "undefined" && document.documentElement.dataset.perf === "lite";

function build(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(ctx.destination);

    // a soft echo (dotted eighth) that gives the plucks some room
    const delay = ctx.createDelay(1);
    delay.delayTime.value = EIGHTH * 1.5;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2200;
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    send = ctx.createGain();
    send.gain.value = 1;
    send.connect(delay);
    delay.connect(tone);
    tone.connect(fb);
    fb.connect(delay);
    tone.connect(wet);
    wet.connect(bus);
  } catch {
    ctx = null;
    return null;
  }
  return ctx;
}

function target() {
  return enabled && !ducked && !hidden ? GAIN[level] : 0;
}

function applyVolume(fast = false) {
  if (!ctx || !bus) return;
  bus.gain.setTargetAtTime(target(), ctx.currentTime, fast ? 0.15 : 0.9);
}

function pad(c: AudioContext, chord: Chord, t: number) {
  const dur = EIGHTH * STEPS;
  const flt = c.createBiquadFilter();
  flt.type = "lowpass";
  flt.frequency.setValueAtTime(520, t);
  flt.frequency.linearRampToValueAtTime(1100, t + dur * 0.55);
  flt.frequency.linearRampToValueAtTime(600, t + dur + 1.5);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.5, t + 1.8);
  g.gain.setValueAtTime(0.5, t + dur - 0.4);
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 2);
  flt.connect(g);
  g.connect(bus!);
  g.connect(send!);
  const detunes = lite() ? [0] : [-7, 7];
  for (const note of chord.notes) {
    for (const d of detunes) {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = hz(note);
      o.detune.value = d;
      const v = c.createGain();
      v.gain.value = 0.11;
      o.connect(v).connect(flt);
      o.start(t);
      o.stop(t + dur + 2.1);
    }
    // airy octave above
    const s = c.createOscillator();
    s.type = "sine";
    s.frequency.value = hz(note + 12);
    const sv = c.createGain();
    sv.gain.value = 0.05;
    s.connect(sv).connect(flt);
    s.start(t);
    s.stop(t + dur + 2.1);
  }
}

function bass(c: AudioContext, note: number, t: number) {
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.value = hz(note);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.55, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, t + EIGHTH * 7.5);
  o.connect(g).connect(bus!);
  o.start(t);
  o.stop(t + EIGHTH * 7.6);
}

function pluck(c: AudioContext, note: number, t: number, vel: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.28 * vel, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  const flt = c.createBiquadFilter();
  flt.type = "lowpass";
  flt.frequency.setValueAtTime(3200, t);
  flt.frequency.exponentialRampToValueAtTime(900, t + 0.6);
  flt.connect(g);
  g.connect(bus!);
  g.connect(send!);
  for (const [type, mult, vol] of [["triangle", 1, 1], ["sine", 2, 0.35]] as const) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = hz(note) * mult;
    const v = c.createGain();
    v.gain.value = vol;
    o.connect(v).connect(flt);
    o.start(t);
    o.stop(t + 1.5);
  }
}

function heartbeat(c: AudioContext, t: number, vel: number) {
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.5 * vel, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o.connect(g).connect(bus!);
  o.start(t);
  o.stop(t + 0.4);
}

function schedule(c: AudioContext, t: number) {
  if (step === 0) {
    if (chordIndex === 0) {
      progression = PROGRESSIONS[Math.floor(Math.random() * PROGRESSIONS.length)];
      arp = ARP[Math.floor(Math.random() * ARP.length)];
    }
  }
  const chord = progression[chordIndex];
  if (step === 0) pad(c, chord, t);
  if (step === 0 || step === 8) bass(c, chord.bass, t);
  if (step % 4 === 0) heartbeat(c, t, step % 8 === 0 ? 0.75 : 0.4);
  const pick = arp[step];
  if (pick >= 0 && Math.random() > 0.12) {
    const tone = pick === 3 ? chord.notes[0] + 12 : chord.notes[pick];
    pluck(c, tone + 12, t + (Math.random() - 0.5) * 0.012, 0.75 + Math.random() * 0.25);
  }
  step += 1;
  if (step >= STEPS) {
    step = 0;
    chordIndex = (chordIndex + 1) % progression.length;
  }
}

function tick() {
  if (!ctx || hidden) return;
  const ahead = 0.8;
  if (next < ctx.currentTime) next = ctx.currentTime + 0.05;
  while (next < ctx.currentTime + ahead) {
    schedule(ctx, next);
    next += EIGHTH;
  }
}

export function startMusic() {
  if (!enabled || !unlocked || timer) return;
  const c = build();
  if (!c) return;
  if (c.state === "suspended") void c.resume().catch(() => {});
  step = 0;
  chordIndex = 0;
  next = c.currentTime + 0.1;
  timer = setInterval(tick, 200);
  applyVolume();
}

export function stopMusic() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (ctx && bus) bus.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
}

export function configureMusic(on: boolean, vol: Level) {
  enabled = on;
  level = vol;
  if (!on) stopMusic();
  else if (unlocked) {
    if (!timer) startMusic();
    applyVolume(true);
  }
}

/** a match has its own crowd and whistles: the music steps back, then returns */
export function duckMusic(on: boolean) {
  ducked = on;
  applyVolume(true);
}

/** music can start once the person has touched the screen */
export function unlockMusic() {
  if (typeof window === "undefined") return;
  const wake = () => {
    unlocked = true;
    startMusic();
    window.removeEventListener("pointerdown", wake);
    window.removeEventListener("keydown", wake);
  };
  window.addEventListener("pointerdown", wake, { passive: true });
  window.addEventListener("keydown", wake);
  document.addEventListener("visibilitychange", () => {
    hidden = document.hidden;
    if (!ctx) return;
    if (hidden) {
      applyVolume(true);
      void ctx.suspend().catch(() => {});
    } else {
      void ctx.resume().catch(() => {});
      next = ctx.currentTime + 0.1;
      applyVolume();
    }
  });
}
