import { useEffect, useState, useSyncExternalStore } from 'react';
import * as D from './data';
import base from './theme.default.json';
import type { Msg } from './data';
import { ring, setVolume, sfx } from './sound';
import { intl, t } from './i18n';

let n = 5000;
export const uid = () => ++n;

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
export type Call = { number: string; state: 'incoming' | 'outgoing' | 'active'; video: boolean; start: number; muted: boolean; speaker: boolean; min: boolean };
export type AlertDef = {
  title: string;
  message?: string;
  image?: string;
  input?: string;
  value?: string;
  buttons: { label: string; kind?: 'cancel' | 'destructive' | 'bold'; run?: (input: string) => void }[];
};
export type ActionDef = { title?: string; options: { label: string; destructive?: boolean; run: () => void }[] };
export type ShareDef = { kind: string; label: string; seed?: number };

/* ponytail: one mutable object + a version counter. Every subscriber re-renders on any change,
 * which is fine for a phone-sized tree; move to per-slice selectors if profiling ever says so. */
export const S = {
  open: true,
  /** Browser demo: centre the phone and enlarge it. In-game it sits bottom-right. */
  focus: true,
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
    wallpaper: base.defaults.wallpaper,
    lockWallpaper: base.defaults.lockWallpaper,
    passcode: '',
    faceId: true,
    clock24: false,
    ringtone: 'Reflection',
    texttone: 'Tri-tone',
    hideCallerId: false,
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
  job: D.job,
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
  setVolume(S.settings.volume, S.settings.silent);
  subs.forEach((f) => f());
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
    else if (s.app) s.closing = true;
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
  sfx('lock');
  update((s) => {
    s.locked = true;
    s.cc = s.nc = s.search = s.edit = s.passPad = false;
    // An app's open dialog must not float over the lock screen.
    s.ui.alert = s.ui.actions = s.ui.share = null;
  });
}

export function unlock(force = false) {
  if (!S.locked || S.unlocking) return;
  if (S.settings.passcode && !S.settings.faceId && !force) return update((s) => (s.passPad = true));
  // Face unlock: the padlock opens, then the lock screen lifts away.
  update((s) => (s.unlocking = true));
  window.setTimeout(() => {
    sfx('lock');
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
export function startCall(number: string, video = false) {
  if (S.settings.airplane) return alert({ title: t('airplane_mode'), message: t('sys_turn_off_airplane_mode_to_make'), buttons: [{ label: t('ok'), kind: 'bold' }] });
  if (S.call) return;
  update((s) => (s.call = { number, state: 'outgoing', video, start: Date.now(), muted: false, speaker: video, min: false }));
  ring('ringback');
  // Mock: the other side picks up after a few seconds.
  callTimer = window.setTimeout(answer, 3400);
}

export function incomingCall(number: string, video = false) {
  if (S.call || S.settings.airplane) return;
  if (contactOf(number)?.blocked) return;
  update((s) => (s.call = { number, state: 'incoming', video, start: Date.now(), muted: false, speaker: video, min: false }));
  if (!S.settings.dnd) ring('ring');
}

export function answer() {
  ring(null);
  update((s) => {
    if (s.call) Object.assign(s.call, { state: 'active', start: Date.now() });
  });
}

export function hangup() {
  const c = S.call;
  if (!c) return;
  window.clearTimeout(callTimer);
  ring(null);
  sfx('end');
  update((s) => {
    s.calls.unshift({
      id: uid(),
      number: c.number,
      dir: c.state === 'incoming' ? 'missed' : c.state === 'outgoing' ? 'out' : 'in',
      time: Date.now(),
      video: c.video,
      dur: c.state === 'active' ? Math.round((Date.now() - c.start) / 1000) : undefined,
    });
    s.call = null;
  });
}

/* ---------- messages ---------- */

export function chatWith(number: string) {
  let c = S.chats.find((x) => x.numbers.length === 1 && x.numbers[0] === number);
  if (!c) {
    c = { id: uid(), numbers: [number], msgs: [], unread: 0 };
    S.chats.unshift(c);
  }
  return c.id;
}

export const preview = (msg?: Msg) =>
  !msg ? t('no_messages') : msg.text ?? (msg.pic ? t('photo') : msg.loc ? t('preview_location') : msg.money ? t('preview_sent', { amount: money(msg.money, 0) }) : msg.voice ? t('preview_voice') : msg.gif ? 'GIF' : '');

export function sendMsg(chatId: number, msg: Partial<Msg>) {
  const chat = S.chats.find((c) => c.id === chatId);
  if (!chat) return;
  if (msg.money) {
    if (msg.money > S.wallet.balance) return alert({ title: t('insufficient_funds'), message: t('your_balance_is_too_low_for'), buttons: [{ label: t('ok'), kind: 'bold' }] });
    pay(-msg.money, nameOf(chat.numbers[0]));
  }
  update((s) => {
    chat.msgs.push({ ...msg, id: uid(), me: true, time: Date.now() });
    s.chats = [chat, ...s.chats.filter((c) => c !== chat)];
  });
  sfx('sent');
  if (S.settings.airplane || chat.numbers.length > 1) return;
  // Mock: the contact types for a moment, then answers.
  window.setTimeout(() => update((s) => (s.typing = chatId)), 900);
  window.setTimeout(() => receiveMsg(chat.numbers[0], { text: D.replies[Math.floor(Math.random() * D.replies.length)] }), 2800);
}

export function receiveMsg(number: string, msg: Partial<Msg>) {
  const id = chatWith(number);
  const chat = S.chats.find((c) => c.id === id)!;
  const viewing = S.app === 'messages' && S.viewChat === id && !S.locked;
  const full = { ...msg, id: uid(), time: Date.now() };
  update((s) => {
    s.typing = null;
    chat.msgs.push(full);
    if (!viewing) chat.unread++;
    s.chats = [chat, ...s.chats.filter((c) => c !== chat)];
  });
  if (viewing) sfx('received');
  else notify({ app: 'messages', title: nameOf(number), body: preview(full), tap: () => openApp('messages', null, { chat: id }) });
}

export function pay(amount: number, label: string) {
  update((s) => {
    s.wallet.balance += amount;
    s.wallet.txs.unshift({ id: uid(), label, amount, time: Date.now() });
  });
}

export function addPhoto(p: { video?: number; selfie?: boolean; seed?: number } = {}) {
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
// ponytail: playback is a ticking position, no audio. Wire real streams (or xsound) here when the Lua side exists.
window.setInterval(() => {
  const mu = S.music;
  if (!mu.playing || mu.id == null) return;
  const song = D.songs.find((x) => x.id === mu.id)!;
  if (mu.pos + 1 >= song.dur) skip(1);
  else update((s) => s.music.pos++);
}, 1000);
