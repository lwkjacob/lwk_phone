/* Phone sounds. Ringtones, text tones and a few effects are recordings in web/public/sounds/ (sources and
 * licences: CREDITS.txt there); dial tones, the ringback and anything whose file is missing are synthesised. */

/** Set to false to silence the phone entirely; nothing else needs touching. */
const ENABLED = true;

/** The choices in Settings. Each is the file sounds/ring-<name>.mp3 or sounds/tone-<name>.mp3, lower-cased. */
export const RINGTONES = ['Signal', 'Marimba', 'Vibes', 'Kalimba', 'Classic'];
export const TEXTTONES = ['Xylo', 'Duo', 'Chord', 'Ding'];
/** A saved choice that is no longer on the list plays (and shows as) the first one. */
export const toneOf = (name: string, list: string[]) => (list.includes(name) ? name : list[0]);

/**
 * Per-file mix. The recordings come from different people at very different loudness: `gain` evens them
 * out, `offset` skips a lead-in, `length` cuts a long take (with a short fade). Seconds.
 * ponytail: set from measured peak and RMS, not by ear. Nudge these after a listen in-game.
 */
const CLIPS: Record<string, { gain: number; offset?: number; length?: number }> = {
  'ring-signal': { gain: 0.6 },
  'ring-marimba': { gain: 0.9 },
  'ring-vibes': { gain: 2.2 },
  'ring-kalimba': { gain: 1 },
  'ring-classic': { gain: 5 },
  'tone-xylo': { gain: 3, length: 1.2 },
  'tone-duo': { gain: 1.6 },
  'tone-chord': { gain: 1.2 },
  'tone-ding': { gain: 0.8 },
  sent: { gain: 2.5 },
  received: { gain: 0.6, offset: 0.12, length: 0.35 },
  shutter: { gain: 0.9, offset: 0.66, length: 0.62 },
  alarm: { gain: 0.6, offset: 1.3, length: 2.05 },
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let level = 0.6;
let ringtone = RINGTONES[0];
let texttone = TEXTTONES[0];
const clips = new Map<string, AudioBuffer | null | 'loading'>();
// What each slot is playing, so a tone that is triggered again restarts instead of piling up.
const playing: Record<string, AudioBufferSourceNode | undefined> = {};

/** Ears hear loudness logarithmically: squaring makes the 0-1 slider feel even. */
const masterGain = () => 0.8 * level ** 2;

function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  master!.gain.value = masterGain();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

async function load(file: string) {
  if (clips.has(file)) return;
  clips.set(file, 'loading');
  try {
    const res = await fetch(`./sounds/${file}.mp3`);
    // A dev server answers a missing file with index.html; decoding that throws, which is the right outcome.
    clips.set(file, res.ok ? await audio().decodeAudioData(await res.arrayBuffer()) : null);
  } catch {
    clips.set(file, null);
  }
}

/** The recording behind a sound, if it has one. */
const fileFor = (name: string) => (name === 'ring' ? `ring-${ringtone.toLowerCase()}` : name === 'notify' ? `tone-${texttone.toLowerCase()}` : name in CLIPS ? name : null);

/** Follow the phone's settings. Called on every state change, so it only does work when something differs. */
export function setSound(s: { volume: number; silent: boolean; ringtone: string; texttone: string }) {
  level = s.silent ? 0 : s.volume;
  if (master) master.gain.value = masterGain();
  ringtone = toneOf(s.ringtone, RINGTONES);
  texttone = toneOf(s.texttone, TEXTTONES);
  // Fetched ahead of time: a ringtone that starts a second late is a missed call.
  if (ENABLED) for (const name of ['ring', 'notify', 'sent', 'received', 'shutter', 'alarm']) load(fileFor(name)!);
}

/** Play a recording in `slot`. False when it is not loaded (yet), so the caller can fall back. */
function play(slot: string, file: string, opts: { loop?: boolean; length?: number } = {}) {
  const buf = clips.get(file);
  if (!buf || buf === 'loading') return false;
  const ac = audio();
  const clip = CLIPS[file];
  const src = ac.createBufferSource();
  const g = ac.createGain();
  src.buffer = buf;
  src.loop = !!opts.loop;
  g.gain.value = clip.gain;
  src.connect(g).connect(master!);
  const now = ac.currentTime;
  const length = opts.length ?? clip.length;
  src.start(now, clip.offset ?? 0);
  if (length && !opts.loop) {
    // Fade the tail instead of cutting it.
    g.gain.setValueAtTime(clip.gain, now + Math.max(length - 0.15, 0));
    g.gain.linearRampToValueAtTime(0.0001, now + length);
    src.stop(now + length + 0.02);
  }
  stop(slot);
  playing[slot] = src;
  return true;
}

function stop(slot: string) {
  try {
    playing[slot]?.stop();
  } catch {
    // already ended
  }
  playing[slot] = undefined;
}

/* ---------- synthesised: dial tones, the ringback, and stand-ins for a missing file ---------- */

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
  // 440 + 480 Hz is the real ringback tone, so this one is not a stand-in.
  ringback: (ac: AudioContext, t: number) => (tone(ac, t, 440, 1.6, 0.03), tone(ac, t, 480, 1.6, 0.03)),
  end: (ac: AudioContext, t: number) => [480, 380].forEach((f, i) => tone(ac, t + i * 0.16, f, 0.18, 0.05)),
  alarm: (ac: AudioContext, t: number) => [0, 0.2, 0.4, 0.6].forEach((d) => tone(ac, t + d, 1480, 0.12, 0.06, 'square')),
};

export function sfx(name: keyof typeof FX | { key: string }) {
  if (!ENABLED || level <= 0) return;
  try {
    const ac = audio();
    const t = ac.currentTime;
    if (typeof name === 'object') return void DTMF[name.key]?.forEach((f) => tone(ac, t, f, 0.16, 0.035));
    const file = fileFor(name);
    // 'ring' on its own is the preview in Settings: the opening of the ringtone, not the loop.
    if (file && play(name, file, name === 'ring' ? { length: 4 } : {})) return;
    if (file) load(file);
    FX[name](ac, t);
  } catch {
    // Audio is decoration; never let it break a flow.
  }
}

let ringTimer: number | undefined;
/** Ring (an incoming call) or play the ringback (an outgoing one) until called with null. */
export function ring(kind: 'ring' | 'ringback' | null) {
  window.clearInterval(ringTimer);
  stop('ring');
  if (!kind || !ENABLED || level <= 0) return;
  try {
    if (kind === 'ring' && play('ring', fileFor('ring')!, { loop: true })) return;
    const again = () => FX[kind](audio(), ctx!.currentTime);
    again();
    ringTimer = window.setInterval(again, kind === 'ring' ? 2400 : 3200);
  } catch {
    // as above
  }
}
