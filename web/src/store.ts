import { useEffect, useState, useSyncExternalStore } from 'react';
import * as D from './data';
import base from './theme.default.json';
import type { Chat, Msg, Seed } from './data';
import { inGame, rpc, type Res } from './net';
import { RINGTONES, TEXTTONES, ring, setSound, sfx } from './sound';
import { intl, t } from './i18n';

let n = 5000;
/** A local id. In-game these are negative and time-based, so they never collide with ids the server hands out, now or after a reload. */
export const uid = () => (inGame ? -(Date.now() * 100 + (++n % 100)) : ++n);

/** Current phone zoom factor, set by the shell. Pointer deltas are viewport px: divide by this for layout px. */
export const view = { k: 1 };

/**
 * An element's box in viewport px (the space pointer events use).
 * Old CEF reports rects inside a CSS-zoomed element unzoomed, current Chrome reports them zoomed;
 * measuring the screen (always 393 layout px wide) tells us which and corrects for it.
 */
export function viewportRect(el: Element) {
  const scr = document.getElementById('screen');
  const f = scr ? view.k / (scr.getBoundingClientRect().width / 393) : 1;
  const r = el.getBoundingClientRect();
  return { left: r.left * f, top: r.top * f, width: r.width * f, height: r.height * f };
}

export type Notif = { id: number; app: string; title: string; body: string; time: number; tap?: () => void };
export type Call = { number: string; /** 'voicemail': nobody picked up, and the caller is leaving a message. */ state: 'incoming' | 'outgoing' | 'active' | 'voicemail'; video: boolean; start: number; muted: boolean; speaker: boolean; min: boolean; /** We placed the call. */ out: boolean };
export type AlertDef = {
  title: string;
  message?: string;
  image?: string;
  input?: string;
  value?: string;
  buttons: { label: string; kind?: 'cancel' | 'destructive' | 'bold'; run?: (input: string) => void }[];
};
export type ActionDef = { title?: string; options: { label: string; destructive?: boolean; run: () => void }[] };
export type ShareDef = { kind: string; label: string; seed?: Seed; /** What the receiver gets over AirShare. */ item?: Record<string, unknown> };

/* ponytail: one mutable object + a version counter. Every subscriber re-renders on any change,
 * which is fine for a phone-sized tree; move to per-slice selectors if profiling ever says so. */
export const S = {
  open: !inGame,
  /** Browser demo: centre the phone and enlarge it. In-game it sits bottom-right. */
  focus: !inGame,
  locked: true,
  unlocking: false,
  passPad: false,
  app: null as string | null,
  closing: false,
  origin: { x: 196, y: 426, w: 0, h: 0 },
  arg: null as Record<string, number | string> | null,
  cc: false,
  nc: false,
  search: false,
  edit: false,
  flashlight: false,
  /** The phone is held sideways. Only some screens ask for this: Camera, the photo viewer, community apps with `landscape`. */
  landscape: false,
  /** First-run setup still to do. */
  setup: inGame ? false : !window.localStorage.getItem('phone.setup'),
  /** Per-app data state. Missing means not requested yet. */
  loaded: {} as Record<string, 'loading' | 'ready' | 'error'>,
  /** Browser demo only: how the fake server behaves, to exercise loading and failure states. */
  net: 'fast' as 'fast' | 'slow' | 'fail',
  /** Setup: an old phone found for this player, and what is on it. In-game the server says; the dev panel can pretend. */
  oldPhone: null as null | { from: string; counts: { contacts: number; threads: number; calls: number; photos: number; notes: number } },
  /** A full-screen app (a game, say) asked for the home indicator to be hidden. It still works, it is just not drawn. */
  hideHomeBar: false,
  settings: {
    dark: base.defaults.dark,
    airplane: false,
    cellular: true,
    wifi: true,
    bluetooth: true,
    dnd: false,
    streamer: false,
    silent: false,
    brightness: 1,
    volume: 0.6,
    size: 1,
    frame: base.defaults.frame,
    /** Used when `frame` is 'custom'. */
    frameColor: '#7a5cff',
    wallpaper: base.defaults.wallpaper,
    lockWallpaper: base.defaults.lockWallpaper,
    passcode: '',
    faceId: true,
    clock24: false,
    ringtone: RINGTONES[0],
    texttone: TEXTTONES[0],
    hideCallerId: false,
    /** Maps shows the satellite view instead of the road map. */
    satellite: true,
    muted: {} as Record<string, boolean>,
  },
  apps: [...base.defaults.apps],
  dock: [...base.defaults.dock],
  notifs: [] as Notif[],
  banner: null as Notif | null,
  call: null as Call | null,
  music: { id: null as number | null, playing: false, pos: 0, queue: [] as number[] },
  rec: null as number | null,
  typing: null as number | null,
  viewChat: null as number | null,
  seenCalls: Date.now() - 3 * 3_600_000,
  ui: { alert: null as AlertDef | null, actions: null as ActionDef | null, share: null as ShareDef | null },
  /** In-game: the account this phone is signed in to, per social app. */
  accounts: {} as Record<string, string | undefined>,
  /** In-game: this phone's Ember profile; false = none yet. */
  emberProfile: null as null | false | { name: string; age: number; bio: string; job: string; seeds: Seed[] },
  /** In-game: where the player is (Maps). */
  position: null as null | { x: number; y: number; street: string },
  /** Server settings the UI needs. */
  cfg: {
    map: { image: '', bounds: { minX: -4000, maxX: 4500, minY: -4000, maxY: 8000 } },
    upload: false,
    mailDomain: 'lsmail.net',
    garage: { valetFee: 100, impoundFee: 250 },
    unique: false,
    admin: false,
  },
  me: D.me,
  contacts: D.contacts,
  calls: D.calls,
  voicemail: D.voicemail,
  chats: D.chats,
  photos: D.photos,
  notes: D.notes,
  mail: D.mail,
  alarms: D.alarms,
  memos: D.memos,
  wallet: D.wallet,
  houses: D.houses,
  vehicles: D.vehicles,
  job: D.job as D.Job | false,
  users: D.users,
  dms: D.dms,
  flock: D.flock,
  lumen: D.lumen,
  stories: D.stories,
  loop: D.loop,
  ember: D.ember,
  matches: D.matches,
  shade: D.shade,
  adverts: D.adverts,
  market: D.market,
  coins: D.coins,
};

let version = 0;
const subs = new Set<() => void>();
const subscribe = (f: () => void) => (subs.add(f), () => void subs.delete(f));

export function update(fn?: (s: typeof S) => void) {
  fn?.(S);
  version++;
  setSound(S.settings);
  subs.forEach((f) => f());
  autosave();
  syncAudio();
}

/* ---------- server data ---------- */

/**
 * Lay data from the server over the state. Keys are slices of S; a few lists live in data.ts as
 * module-level arrays (services, songs, places...) and are refilled in place so every import sees them.
 */
export function hydrate(data: Record<string, unknown>) {
  const s = S as Record<string, unknown>;
  const d = D as Record<string, unknown>;
  for (const [k, v] of Object.entries(data)) {
    if (v == null) continue;
    if (k === 'settings' || k === 'dms' || k === 'cfg') Object.assign(s[k] as object, v);
    else if (k in s) s[k] = v;
    else if (Array.isArray(d[k])) (d[k] as unknown[]).splice(0, Infinity, ...(v as unknown[]));
    else if (d[k] && typeof d[k] === 'object') Object.assign(d[k] as object, v);
  }
  update();
}

/** Throw away the browser demo's mock data. In-game everything comes from the server instead. */
export function blank() {
  hydrate({
    contacts: [], calls: [], voicemail: [], chats: [], photos: [], notes: [], mail: [], alarms: [], memos: [], notifs: [],
    wallet: { balance: 0, cash: 0, iban: '', txs: [] }, houses: [], vehicles: [], job: false, users: {}, accounts: {},
    dms: { flock: [], lumen: [] }, flock: [], lumen: [], stories: [], loop: [], ember: [], matches: [], emberProfile: null,
    shade: { alias: '', channels: [] }, adverts: [], market: [], coins: [], loaded: {},
    services: [], songs: [], playlists: [], trends: [], places: [],
  });
}

/* Private data (contacts, notes, settings...) is saved generically: after any change, the slices below are
 * compared with what the server last got and the changed ones are sent. To persist a new private slice,
 * add its key here and to SAVE in server/main.lua. */
const SAVE_KEYS = ['contacts', 'notes', 'alarms', 'memos', 'photos', 'settings', 'apps', 'dock', 'seenCalls', 'setup', 'playlists', 'worldClocks'];
const saved: Record<string, string> = {};
let synced = false;
let saveTimer: number | undefined;
const sliceOf = (k: string) => JSON.stringify((S as Record<string, unknown>)[k] ?? (D as Record<string, unknown>)[k]);

/** The state now matches the server: start watching for changes from here. Pass false to stop watching (the phone is being swapped). */
export function markSaved(on = true) {
  if (on) for (const k of SAVE_KEYS) saved[k] = sliceOf(k);
  synced = on;
}

function autosave() {
  if (!inGame || !synced) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    for (const k of SAVE_KEYS) {
      const v = sliceOf(k);
      if (v === saved[k]) continue;
      saved[k] = v;
      rpc('save', { k, v });
    }
  }, 600);
}

/**
 * A request whose answer carries fresh slices (wallet, vehicles, job...). Shows the error if it fails;
 * otherwise lays the slices over the state and resolves to the answer. Null in the browser demo.
 */
export async function send<T = object>(name: string, data?: unknown) {
  const r = await rpc<T>(name, data);
  if (!r || failed(r)) return null;
  const { ok: _ok, ...slices } = r;
  hydrate(slices);
  return r;
}

/** Show why a request failed. Returns true when it did, so callers can `if (failed(r)) return`. */
export function failed(r: Res<unknown> | null): boolean {
  if (!r || r.ok) return false;
  alert({ title: r.error ?? t('load_failed_title'), buttons: [{ label: t('ok'), kind: 'bold' }] });
  return true;
}

export function useS() {
  useSyncExternalStore(subscribe, () => version);
  return S;
}

/** Re-render on an interval and hand back the current time (clocks, call timers). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

/* In-game the phone's clock shows the game's time of day: Lua sends it whenever the minute changes
 * (client/main.lua). It is kept as a whole timestamp, today's date with the game's hour and minute, so
 * anything that formats a time can take it. This is only for "what time is it now": the times on messages
 * and calls, and every timer, stay on the real clock. */
let gameClock: number | null = null;
const clockSubs = new Set<() => void>();

export function setClock(h: number, m: number) {
  gameClock = new Date().setHours(h, m, 0, 0);
  clockSubs.forEach((f) => f());
}

/** The time the phone's clock shows. Re-read every `ms`, and at once when the game's minute changes. */
export function useClock(ms = 1000) {
  const [, tick] = useState(0);
  useEffect(() => {
    const again = () => tick((n) => n + 1);
    clockSubs.add(again);
    const timer = window.setInterval(again, ms);
    return () => (clockSubs.delete(again), window.clearInterval(timer));
  }, [ms]);
  return gameClock ?? Date.now();
}

/* ---------- formatting ---------- */

export const pad = (v: number) => String(v).padStart(2, '0');
export function fmtTime(t: number | Date, ampm = false) {
  const d = new Date(t);
  if (S.settings.clock24) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const s = `${d.getHours() % 12 || 12}:${pad(d.getMinutes())}`;
  return ampm ? `${s} ${d.getHours() < 12 ? 'AM' : 'PM'}` : s;
}
export function fmtAgo(time: number) {
  const diff = Date.now() - time;
  const day = 86_400_000;
  if (diff < 60_000) return t('time_now');
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < day) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 2 * day) return t('time_yesterday');
  if (diff < 7 * day) return new Date(time).toLocaleDateString(intl, { weekday: 'long' });
  return new Date(time).toLocaleDateString(intl, { month: 'short', day: 'numeric' });
}
export const fmtDur = (sec: number) => `${Math.floor(sec / 60)}:${pad(Math.floor(sec % 60))}`;
export const money = (v: number, digits = 2) => v.toLocaleString(intl, { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits });
export const compact = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e4 ? `${(v / 1e3).toFixed(1)}K` : v.toLocaleString(intl));

export const contactOf = (number: string) => S.contacts.find((c) => c.number === number);
export const nameOf = (number: string) => contactOf(number)?.name ?? number;

/* ---------- shell ---------- */

/** Apps with no screen of their own: opening one just runs its action (community apps registered without a UI). */
export const actionApps = new Map<string, () => void>();

export function openApp(id: string, from?: Element | null, arg?: Record<string, number | string>) {
  const action = actionApps.get(id);
  if (action) return action();
  const scr = document.getElementById('screen');
  // Where the app grows from and shrinks back to: the tapped icon's box, or the screen centre with no size.
  let origin = { x: 196, y: 426, w: 0, h: 0 };
  if (from && scr) {
    const a = from.getBoundingClientRect();
    const b = scr.getBoundingClientRect();
    const k = b.width / 393;
    origin = { x: (a.left + a.width / 2 - b.left) / k, y: (a.top + a.height / 2 - b.top) / k, w: a.width / k, h: a.height / k };
  }
  window.clearTimeout(closeTimer);
  update((s) => {
    s.app = id;
    s.closing = false;
    s.landscape = false;
    s.origin = origin;
    s.arg = arg ?? null;
    s.cc = s.nc = s.search = s.edit = false;
    if (s.call) s.call.min = true;
  });
}

let closeTimer: number | undefined;

/** Unmount the app once its closing animation is done. */
export function finishClose() {
  window.clearTimeout(closeTimer);
  if (S.closing) update((s) => ((s.app = null), (s.closing = false)));
}

export function goHome() {
  update((s) => {
    if (s.cc || s.nc || s.search) s.cc = s.nc = s.search = false;
    else if (s.call && !s.call.min && s.call.state !== 'incoming') s.call.min = true;
    else if (s.app) {
      s.closing = true;
      s.landscape = false;
    }
    else s.edit = false;
  });
  // The animation's end event normally unmounts the app. If that event never arrives (throttled or
  // hidden page), the app would sit invisible forever, so a timer guarantees the unmount.
  if (S.closing) {
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(finishClose, 600);
  }
}

export function lock() {
  update((s) => {
    s.locked = true;
    s.cc = s.nc = s.search = s.edit = s.passPad = s.landscape = false;
    // An app's open dialog must not float over the lock screen.
    s.ui.alert = s.ui.actions = s.ui.share = null;
  });
}

/** Setup finished: remember it and go straight to the home screen. */
export function finishSetup() {
  // The browser demo remembers this locally; in-game `setup` is one of the saved slices.
  if (!inGame) window.localStorage.setItem('phone.setup', 'done');
  update((s) => ((s.setup = false), (s.locked = false)));
}

export function unlock(force = false) {
  if (!S.locked || S.unlocking) return;
  if (S.settings.passcode && !S.settings.faceId && !force) return update((s) => (s.passPad = true));
  // Face unlock: the padlock opens, then the lock screen lifts away.
  update((s) => (s.unlocking = true));
  window.setTimeout(() => {
    update((s) => (s.locked = s.unlocking = s.passPad = false));
  }, force ? 0 : 420);
}

let bannerTimer: number | undefined;
export function notify(nf: Omit<Notif, 'id' | 'time'>) {
  if (S.settings.muted[nf.app]) return;
  const x = { ...nf, id: uid(), time: Date.now() };
  update((s) => {
    s.notifs.unshift(x);
    if (!s.settings.dnd) s.banner = x;
  });
  if (S.settings.dnd) return;
  sfx('notify');
  window.clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => update((s) => (s.banner = null)), 4500);
}

export function tapNotif(nf: Notif) {
  update((s) => {
    s.notifs = s.notifs.filter((x) => x.id !== nf.id);
    s.banner = null;
    s.nc = false;
  });
  if (nf.tap) nf.tap();
  else openApp(nf.app);
}

export const alert = (a: AlertDef) => update((s) => (s.ui.alert = a));
export const confirm = (title: string, message: string, label: string, run: () => void) =>
  alert({ title, message, buttons: [{ label: t('cancel'), kind: 'cancel' }, { label, kind: 'destructive', run }] });
export const prompt = (title: string, placeholder: string, run: (v: string) => void, value = '', message?: string) =>
  alert({ title, message, input: placeholder, value, buttons: [{ label: t('cancel'), kind: 'cancel' }, { label: t('save'), kind: 'bold', run: (v) => v.trim() && run(v.trim()) }] });
export const actions = (a: ActionDef) => update((s) => (s.ui.actions = a));
export const share = (d: ShareDef) => update((s) => (s.ui.share = d));

export function badge(app: string) {
  if (app === 'messages') return S.chats.reduce((a, c) => a + c.unread, 0);
  if (app === 'phone') return S.calls.filter((c) => c.dir === 'missed' && c.time > S.seenCalls).length + S.voicemail.filter((v) => !v.heard).length;
  if (app === 'mail') return S.mail.filter((x) => !x.read && !x.sent).length;
  return 0;
}

/* ---------- calls ---------- */

let callTimer: number | undefined;
/** `company` rings every on-duty employee of that job instead of one number. */
export function startCall(number: string, video = false, company?: string) {
  if (S.settings.airplane) return alert({ title: t('airplane_mode'), message: t('sys_turn_off_airplane_mode_to_make'), buttons: [{ label: t('ok'), kind: 'bold' }] });
  if (S.call) return;
  update((s) => (s.call = { number, state: 'outgoing', video, start: Date.now(), muted: false, speaker: video, min: false, out: true }));
  ring('ringback');
  if (inGame) {
    rpc('call.start', { number, video, company }).then((r) => failed(r) && ended());
    return;
  }
  // Mock: the other side picks up after a few seconds.
  callTimer = window.setTimeout(answered, 3400);
}

export function incomingCall(number: string, video = false) {
  if (S.call || S.settings.airplane) return;
  if (contactOf(number)?.blocked) return;
  update((s) => (s.call = { number, state: 'incoming', video, start: Date.now(), muted: false, speaker: video, min: false, out: false }));
  if (!S.settings.dnd) ring('ring');
  // The phone is put away: lift it into view so the call can be seen.
  if (!S.open) notify({ app: 'phone', title: nameOf(number), body: t('incoming_call') });
}

/** The call connected (either side picked up). */
export function answered() {
  ring(null);
  update((s) => {
    if (s.call) Object.assign(s.call, { state: 'active', start: Date.now() });
  });
}

/** Nobody picked up: the caller stays on the line to leave a message. */
export function toVoicemail() {
  ring(null);
  update((s) => {
    if (s.call) Object.assign(s.call, { state: 'voicemail', start: Date.now() });
  });
}

/** The call became a video call, or went back to voice (both sides agreed, or either side stopped the video). */
export function callVideo(on: boolean) {
  update((s) => {
    // A video call is held out in front, on speaker; a voice call goes back to the ear.
    if (s.call) Object.assign(s.call, { video: on, speaker: on });
  });
}

/** The other side wants to turn the cameras on: ask. Accepting is asking back. */
export function videoAsked() {
  const c = S.call;
  if (!c) return;
  alert({
    title: nameOf(c.number),
    message: t('sys_wants_video'),
    buttons: [{ label: t('decline') }, { label: t('accept'), kind: 'bold', run: () => void rpc('call.video', { on: true }) }],
  });
}

/** Pick up an incoming call. */
export function answer() {
  if (!inGame) return answered();
  rpc('call.answer').then((r) => (failed(r) ? ended() : answered()));
}

/** Hang up, decline or cancel. */
export function hangup() {
  if (S.call) rpc('call.end');
  ended();
}

/** The call is over, whoever ended it: log it and clear the screen. */
export function ended() {
  const c = S.call;
  if (!c) return;
  rpc('callAnim', { on: false });
  window.clearTimeout(callTimer);
  ring(null);
  sfx('end');
  update((s) => {
    s.calls.unshift({
      id: uid(),
      number: c.number,
      // A call we placed is outgoing however it ended (answered, rung out, or left as a voicemail).
      dir: c.state === 'incoming' ? 'missed' : c.out ? 'out' : 'in',
      time: Date.now(),
      video: c.video,
      dur: c.state === 'active' ? Math.round((Date.now() - c.start) / 1000) : undefined,
    });
    s.call = null;
  });
}

/* ---------- messages ---------- */

/** Typed-in numbers in the form used as an id everywhere: digits, and seven digits read 555-0142. Mirrors Util.number in Lua. */
export function canon(input: string) {
  const digits = input.replace(/\D/g, '');
  if (digits.length < 3 || digits.length > 11) return input.trim();
  return digits.length === 7 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits;
}

export function chatWith(number: string) {
  let c = S.chats.find((x) => x.numbers.length === 1 && x.numbers[0] === number);
  if (!c) {
    c = { id: uid(), numbers: [number], msgs: [], unread: 0 };
    S.chats.unshift(c);
  }
  return c.id;
}

export const preview = (msg?: Msg) =>
  !msg ? t('no_messages') : msg.text ?? (msg.pic ? t('photo') : msg.loc ? t('preview_location') : msg.money ? t('preview_sent', { amount: money(msg.money, 0) }) : msg.voice ? t('preview_voice') : '');

export function sendMsg(chatId: number, msg: Partial<Msg>) {
  const chat = S.chats.find((c) => c.id === chatId);
  if (!chat) return;
  if (inGame) {
    // The message shows at once; the server confirms it, or it is marked as not delivered.
    const local = { ...msg, id: uid(), me: true, time: Date.now() } as Msg;
    update((s) => {
      chat.msgs.push(local);
      s.chats = [chat, ...s.chats.filter((c) => c !== chat)];
    });
    rpc<{ ch: number; id: number }>('msg.send', { ch: chat.ch, to: chat.numbers, body: msg }).then((r) => {
      update(() => {
        if (r?.ok) Object.assign(chat, { ch: r.ch }), (local.id = r.id);
        else local.failed = true;
      });
      if (msg.money) failed(r);
    });
    return;
  }
  if (msg.money) {
    if (msg.money > S.wallet.balance) return alert({ title: t('insufficient_funds'), message: t('your_balance_is_too_low_for'), buttons: [{ label: t('ok'), kind: 'bold' }] });
    pay(-msg.money, nameOf(chat.numbers[0]));
  }
  // No signal: the message stays in the thread, marked as not delivered.
  const undelivered = S.settings.airplane || undefined;
  update((s) => {
    chat.msgs.push({ ...msg, id: uid(), me: true, time: Date.now(), failed: undelivered });
    s.chats = [chat, ...s.chats.filter((c) => c !== chat)];
  });
  if (undelivered) return;
  sfx('sent');
  if (chat.numbers.length > 1) return;
  // Mock: the contact types for a moment, then answers.
  window.setTimeout(() => update((s) => (s.typing = chatId)), 900);
  window.setTimeout(() => receiveMsg(chat.numbers[0], { text: D.replies[Math.floor(Math.random() * D.replies.length)] }), 2800);
}

/** A message arrived in `chat`: add it, and notify unless that conversation is on screen. */
function deliver(chat: Chat, full: Msg) {
  const viewing = S.open && S.app === 'messages' && S.viewChat === chat.id && !S.locked;
  update((s) => {
    s.typing = null;
    chat.msgs.push(full);
    if (!viewing) chat.unread++;
    s.chats = [chat, ...s.chats.filter((c) => c !== chat)];
  });
  if (viewing) {
    sfx('received');
    if (chat.ch) rpc('msg.read', { ch: chat.ch });
  } else if (!chat.muted) {
    const title = chat.name ?? nameOf(full.from ?? chat.numbers[0]);
    notify({ app: 'messages', title, body: preview(full), tap: () => openApp('messages', null, { chat: chat.id }) });
  }
}

export function receiveMsg(number: string, msg: Partial<Msg>) {
  const id = chatWith(number);
  deliver(S.chats.find((c) => c.id === id)!, { ...msg, id: uid(), time: Date.now() });
}

/** In-game: a text pushed by the server. `members` is everyone in the conversation, this phone included. */
export function serverMsg(m: { ch: number; members: string[]; name?: string; msg: Msg }) {
  if (contactOf(m.msg.from ?? '')?.blocked) return;
  const numbers = m.members.filter((x) => x !== S.me.number);
  let chat = S.chats.find((c) => c.ch === m.ch) ?? (numbers.length === 1 ? S.chats.find((c) => !c.ch && c.numbers.length === 1 && c.numbers[0] === numbers[0]) : undefined);
  if (!chat) {
    chat = { id: m.ch, ch: m.ch, numbers, name: m.name, msgs: [], unread: 0 };
    S.chats.unshift(chat);
  }
  chat.ch = m.ch;
  deliver(chat, m.msg);
}

/** Browser demo only: in-game the server moves the money and pushes the new balance. */
export function pay(amount: number, label: string) {
  if (inGame) return;
  update((s) => {
    s.wallet.balance += amount;
    s.wallet.txs.unshift({ id: uid(), label, amount, time: Date.now() });
  });
}

export function addPhoto(p: { video?: number; selfie?: boolean; seed?: Seed; src?: string } = {}) {
  const photo = { id: uid(), seed: Math.floor(Math.random() * 200), time: Date.now(), ...p };
  update((s) => s.photos.unshift(photo));
  return photo;
}

/* ---------- music ---------- */

export function playSong(id: number, queue?: number[]) {
  update((s) => (s.music = { id, playing: true, pos: 0, queue: queue ?? s.music.queue }));
}
export function skip(dir: 1 | -1) {
  const { queue, id } = S.music;
  const list = queue.length ? queue : D.songs.map((x) => x.id);
  const i = list.indexOf(id ?? -1);
  playSong(list[(i + dir + list.length) % list.length]);
}

/* Songs with a `url` (Config.music, in-game) play for real through this element. The demo's songs
 * have none, so there playback is only a position that ticks. */
const player = new Audio();
let playerUrl = '';
player.onended = () => skip(1);

/** Bring the audio element in line with S.music: which song, playing or paused, where in the song. */
function syncAudio() {
  const mu = S.music;
  const url = (mu.id != null && D.songs.find((x) => x.id === mu.id)?.url) || '';
  if (url !== playerUrl) {
    playerUrl = url;
    if (url) player.src = url;
    else player.removeAttribute('src');
  }
  if (!url) return;
  player.volume = S.settings.volume;
  // More than a tick apart means the scrubber was moved (or the song restarted).
  if (Math.abs(player.currentTime - mu.pos) > 2) player.currentTime = mu.pos;
  if (mu.playing && player.paused) player.play().catch(() => {});
  else if (!mu.playing && !player.paused) player.pause();
}

window.setInterval(() => {
  const mu = S.music;
  if (!mu.playing || mu.id == null) return;
  const song = D.songs.find((x) => x.id === mu.id);
  if (!song) return;
  if (song.url) {
    if (Number.isFinite(player.duration)) song.dur = Math.round(player.duration);
    return update((s) => (s.music.pos = Math.floor(player.currentTime)));
  }
  if (mu.pos + 1 >= song.dur) skip(1);
  else update((s) => s.music.pos++);
}, 1000);
