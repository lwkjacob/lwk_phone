/* Phone sounds, synthesised so the UI ships no audio files.
 * ponytail: swap for recordings (see the bank UI's sound.ts loader) if these need to sound like real hardware. */

/** Sounds are switched off for now. Set to true to bring every effect back; nothing else needs touching. */
const ENABLED = false;

let ctx: AudioContext | null = null;
let level = 0.6;

export const setVolume = (volume: number, silent: boolean) => (level = silent ? 0 : volume);

function tone(ac: AudioContext, at: number, freq: number, len: number, gain = 0.07, type: OscillatorType = 'sine') {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain * level, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g).connect(ac.destination);
  o.start(at);
  o.stop(at + len + 0.02);
}

function hiss(ac: AudioContext, at: number, len: number, gain = 0.1) {
  const buf = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = ac.createBufferSource();
  const g = ac.createGain();
  s.buffer = buf;
  g.gain.value = gain * level;
  s.connect(g).connect(ac.destination);
  s.start(at);
}

const DTMF: Record<string, [number, number]> = {
  1: [697, 1209], 2: [697, 1336], 3: [697, 1477], 4: [770, 1209], 5: [770, 1336], 6: [770, 1477],
  7: [852, 1209], 8: [852, 1336], 9: [852, 1477], '*': [941, 1209], 0: [941, 1336], '#': [941, 1477],
};

const FX = {
  notify: (ac: AudioContext, t: number) => [1175, 1568, 1319].forEach((f, i) => tone(ac, t + i * 0.11, f, 0.35)),
  sent: (ac: AudioContext, t: number) => [520, 780].forEach((f, i) => tone(ac, t + i * 0.06, f, 0.14, 0.05)),
  received: (ac: AudioContext, t: number) => [880, 660].forEach((f, i) => tone(ac, t + i * 0.09, f, 0.2, 0.06)),
  shutter: (ac: AudioContext, t: number) => (hiss(ac, t, 0.05), hiss(ac, t + 0.08, 0.06)),
  lock: (ac: AudioContext, t: number) => (hiss(ac, t, 0.03, 0.06), tone(ac, t, 180, 0.05, 0.05, 'triangle')),
  ring: (ac: AudioContext, t: number) => [0, 0.18, 0.36, 0.54, 0.9, 1.08].forEach((d, i) => tone(ac, t + d, [1047, 1319, 1568][i % 3], 0.3, 0.06, 'triangle')),
  ringback: (ac: AudioContext, t: number) => (tone(ac, t, 440, 1.6, 0.03), tone(ac, t, 480, 1.6, 0.03)),
  end: (ac: AudioContext, t: number) => [480, 380].forEach((f, i) => tone(ac, t + i * 0.16, f, 0.18, 0.05)),
  alarm: (ac: AudioContext, t: number) => [0, 0.2, 0.4, 0.6].forEach((d) => tone(ac, t + d, 1480, 0.12, 0.06, 'square')),
};

export function sfx(name: keyof typeof FX | { key: string }) {
  if (!ENABLED || level <= 0) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    if (typeof name === 'object') DTMF[name.key]?.forEach((f) => tone(ctx!, t, f, 0.16, 0.035));
    else FX[name](ctx, t);
  } catch {
    // Audio is decoration; never let it break a flow.
  }
}

let ringTimer: number | undefined;
export function ring(kind: 'ring' | 'ringback' | null) {
  window.clearInterval(ringTimer);
  if (!kind || !ENABLED) return;
  sfx(kind);
  ringTimer = window.setInterval(() => sfx(kind), kind === 'ring' ? 2400 : 3200);
}
