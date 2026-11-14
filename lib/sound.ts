"use client";

/**
 * GSM sound, built live with the Web Audio API: no audio files to download, so the
 * app stays small and starts instantly. Everything is short and cheap to play.
 * Browsers and WebViews only allow audio after a touch, so the engine wakes up on
 * the first tap and stays quiet until then.
 */

export type SoundName =
  | "tap" | "confirm" | "back" | "error" | "ping" | "coin"
  | "whistle" | "whistleEnd" | "foul" | "card" | "kick"
  | "chance" | "groan" | "goal" | "goalAgainst" | "fanfare";

type Level = "low" | "mid" | "high";
const GAIN: Record<Level, number> = { low: 0.35, mid: 0.65, high: 1 };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let enabled = true;
let level: Level = "mid";
let crowd: { src: AudioBufferSourceNode; gain: GainNode; lfo: OscillatorNode } | null = null;

function ensure(): AudioContext | null {
  if (typeof window === "undefined" || !enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      master = ctx.createGain();
      master.gain.value = GAIN[level];
      master.connect(comp);
      comp.connect(ctx.destination);
    } catch {
      ctx = null;
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

function noiseBuf(c: AudioContext): AudioBuffer {
  if (noise) return noise;
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.04 * w) / 1.04; // soft, crowd-like noise
    d[i] = last * 14 + w * 0.15;
  }
  noise = buf;
  return buf;
}

/** the engine wakes up on the first touch/key */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  const wake = () => {
    ensure();
    window.removeEventListener("pointerdown", wake);
    window.removeEventListener("keydown", wake);
  };
  window.addEventListener("pointerdown", wake, { passive: true });
  window.addEventListener("keydown", wake);
}

export function configureSound(on: boolean, vol: Level) {
  enabled = on;
  level = vol;
  if (master && ctx) master.gain.setTargetAtTime(on ? GAIN[vol] : 0, ctx.currentTime, 0.05);
  if (!on) stopCrowd();
}

type Tone = { f: number; to?: number; t?: number; d: number; v?: number; type?: OscillatorType };
function tone(c: AudioContext, { f, to, t = 0, d, v = 0.25, type = "sine" }: Tone) {
  const o = c.createOscillator();
  const g = c.createGain();
  const at = c.currentTime + t;
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + d);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(v, at + Math.min(0.02, d / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, at + d);
  o.connect(g).connect(master!);
  o.start(at);
  o.stop(at + d + 0.05);
}

type Burst = { t?: number; d: number; v: number; type?: BiquadFilterType; f: number; to?: number; q?: number; attack?: number };
function burst(c: AudioContext, { t = 0, d, v, type = "bandpass", f, to, q = 0.8, attack = 0.02 }: Burst) {
  const s = c.createBufferSource();
  s.buffer = noiseBuf(c);
  s.loop = true;
  const flt = c.createBiquadFilter();
  const g = c.createGain();
  const at = c.currentTime + t;
  flt.type = type;
  flt.Q.value = q;
  flt.frequency.setValueAtTime(f, at);
  if (to) flt.frequency.exponentialRampToValueAtTime(to, at + d);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(v, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + d);
  s.connect(flt).connect(g).connect(master!);
  s.start(at, Math.random() * 1.5);
  s.stop(at + d + 0.05);
}

function whistle(c: AudioContext, t: number, d: number, v = 0.22) {
  const o = c.createOscillator();
  const lfo = c.createOscillator();
  const lg = c.createGain();
  const g = c.createGain();
  const at = c.currentTime + t;
  o.type = "sine";
  o.frequency.value = 2900;
  lfo.frequency.value = 34;
  lg.gain.value = 140;
  lfo.connect(lg).connect(o.frequency);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(v, at + 0.03);
  g.gain.setValueAtTime(v, at + d - 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, at + d);
  o.connect(g).connect(master!);
  o.start(at); lfo.start(at);
  o.stop(at + d + 0.05); lfo.stop(at + d + 0.05);
  burst(c, { t, d, v: v * 0.25, type: "highpass", f: 3500, q: 0.4 });
}

export function sfx(name: SoundName) {
  const c = ensure();
  if (!c || !master) return;
  switch (name) {
    case "tap":
      tone(c, { f: 1200, to: 700, d: 0.05, v: 0.08, type: "triangle" });
      break;
    case "confirm":
      tone(c, { f: 523, d: 0.09, v: 0.16, type: "triangle" });
      tone(c, { f: 784, t: 0.08, d: 0.16, v: 0.16, type: "triangle" });
      break;
    case "back":
      tone(c, { f: 700, to: 420, d: 0.08, v: 0.1, type: "triangle" });
      break;
    case "error":
      tone(c, { f: 220, d: 0.16, v: 0.16, type: "square" });
      tone(c, { f: 165, t: 0.12, d: 0.2, v: 0.16, type: "square" });
      break;
    case "ping":
      tone(c, { f: 880, d: 0.18, v: 0.18 });
      tone(c, { f: 1320, t: 0.12, d: 0.4, v: 0.14 });
      break;
    case "coin":
      tone(c, { f: 1568, d: 0.07, v: 0.12, type: "square" });
      tone(c, { f: 2093, t: 0.07, d: 0.25, v: 0.12, type: "square" });
      break;
    case "whistle":
      whistle(c, 0, 0.55);
      break;
    case "whistleEnd":
      whistle(c, 0, 0.35);
      whistle(c, 0.45, 0.35);
      whistle(c, 0.9, 0.7);
      break;
    case "foul":
      whistle(c, 0, 0.28, 0.2);
      break;
    case "card":
      burst(c, { d: 0.16, v: 0.25, type: "highpass", f: 2500, q: 0.5, attack: 0.005 });
      tone(c, { f: 300, to: 150, d: 0.12, v: 0.1, type: "square" });
      break;
    case "kick":
      tone(c, { f: 170, to: 45, d: 0.12, v: 0.4 });
      burst(c, { d: 0.06, v: 0.18, type: "bandpass", f: 1800, attack: 0.003 });
      break;
    case "chance": // the crowd draws a breath
      burst(c, { d: 1.6, v: 0.22, f: 500, to: 1300, q: 0.7, attack: 1.1 });
      break;
    case "groan": // so close
      burst(c, { d: 1.2, v: 0.22, f: 900, to: 260, q: 0.9, attack: 0.15 });
      break;
    case "goal":
      tone(c, { f: 196, d: 0.5, v: 0.12, type: "sawtooth" });
      burst(c, { d: 3.2, v: 0.55, f: 450, to: 1500, q: 0.6, attack: 0.25 });
      burst(c, { t: 0.2, d: 2.6, v: 0.25, type: "highpass", f: 2400, q: 0.4, attack: 0.4 });
      tone(c, { f: 523, t: 0.15, d: 0.3, v: 0.1, type: "triangle" });
      tone(c, { f: 659, t: 0.4, d: 0.3, v: 0.1, type: "triangle" });
      tone(c, { f: 784, t: 0.65, d: 0.6, v: 0.12, type: "triangle" });
      break;
    case "goalAgainst":
      burst(c, { d: 1.8, v: 0.3, f: 700, to: 200, q: 0.9, attack: 0.1 });
      tone(c, { f: 262, to: 130, d: 0.9, v: 0.1, type: "sawtooth" });
      break;
    case "fanfare": {
      const seq = [523, 659, 784, 1047];
      seq.forEach((f, i) => {
        tone(c, { f, t: i * 0.16, d: 0.4, v: 0.14, type: "sawtooth" });
        tone(c, { f: f / 2, t: i * 0.16, d: 0.4, v: 0.1, type: "triangle" });
      });
      [523, 659, 784].forEach((f) => tone(c, { f, t: 0.7, d: 1.6, v: 0.1, type: "sawtooth" }));
      burst(c, { t: 0.7, d: 2.8, v: 0.3, f: 800, to: 1800, q: 0.5, attack: 0.3 });
      break;
    }
  }
}

/** stadium murmur under the match; swells slowly */
export function startCrowd() {
  const c = ensure();
  if (!c || !master || crowd) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuf(c);
  src.loop = true;
  const flt = c.createBiquadFilter();
  flt.type = "bandpass";
  flt.frequency.value = 650;
  flt.Q.value = 0.5;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.13, c.currentTime + 1.5);
  const lfo = c.createOscillator();
  const lg = c.createGain();
  lfo.frequency.value = 0.12;
  lg.gain.value = 0.04;
  lfo.connect(lg).connect(gain.gain);
  src.connect(flt).connect(gain).connect(master);
  src.start();
  lfo.start();
  crowd = { src, gain, lfo };
}

export function stopCrowd() {
  if (!crowd || !ctx) return;
  const { src, gain, lfo } = crowd;
  crowd = null;
  try {
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
    src.stop(ctx.currentTime + 1.2);
    lfo.stop(ctx.currentTime + 1.2);
  } catch {
    /* already stopped */
  }
}
