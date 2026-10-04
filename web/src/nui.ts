import { APPS, addCustomApp, applySkin, removeCustomApp, type CustomApp } from './apps';
import { sendCustomAppMessage } from './apps/Custom';
import type { CallLog, Chat, Msg } from './data';
import { setLocale, t, type Strings } from './i18n';
import { inGame, nuiFetch, rpc } from './net';
import { setRtcConfig, signal, type Signal } from './rtc';
import { S, addPhoto, alert, answered, blank, ended, hydrate, incomingCall, markSaved, notify, openApp, serverMsg, uid, update } from './store';
import { theme } from './theme';

/* Messages from Lua. Lua talks to the phone with SendNUIMessage({ action = ..., ... }); the phone talks
 * back through net.ts. Outside FiveM the DevPanel posts a few of the same messages to drive the demo. */

export { inGame, nuiFetch };

/**
 * Fetch what an app needs before it can draw. In-game the server's answer is laid over the state (same
 * shapes as data.ts). The browser has the mock data already, so it only simulates the wait.
 */
export async function loadApp(id: string) {
  const first = S.loaded[id] !== 'ready';
  if (first) update((s) => (s.loaded[id] = 'loading'));
  try {
    if (S.settings.airplane) throw new Error('offline');
    if (inGame) {
      const r = await rpc<{ data: Record<string, unknown> }>('appData', { app: id });
      if (!r?.ok) throw new Error('failed');
      hydrate(r.data ?? {});
    } else {
      await new Promise((r) => window.setTimeout(r, S.net === 'fast' ? 0 : 1400));
      if (S.net === 'fail') throw new Error('simulated failure');
    }
    update((s) => (s.loaded[id] = 'ready'));
  } catch {
    // A refresh that fails keeps showing what was already there.
    if (first) update((s) => (s.loaded[id] = 'error'));
  }
}

type Init = {
  number: string;
  name: string;
  /** Saved private slices, each as the JSON text the UI last sent. */
  kv: Record<string, string>;
  chats: Chat[];
  calls: CallLog[];
  accounts: Record<string, string>;
  hidden: string[];
  locale: { ui?: Strings; intl?: string };
  config: {
    map: { image: string; bounds: { minX: number; maxX: number; minY: number; maxY: number } };
    places: { name: string; kind: string; x: number; y: number }[];
    songs: { title: string; artist: string; album?: string; url: string; cover?: string; seconds?: number }[];
    rtc: RTCConfiguration;
    upload: boolean;
    mailDomain: string;
    garage: { valetFee: number; impoundFee: number };
    unique: boolean;
    admin: boolean;
  };
};

const DEFAULT_SETTINGS = JSON.stringify(S.settings);

/** Game coordinates to a position on the map, in percent. */
export function mapPercent(x: number, y: number) {
  const b = S.cfg.map.bounds;
  return { x: ((x - b.minX) / (b.maxX - b.minX)) * 100, y: ((b.maxY - y) / (b.maxY - b.minY)) * 100 };
}

/** A phone came up (first load, or a different phone on unique-phone servers): replace everything with its data. */
function init(d: Init) {
  markSaved(false);
  blank();
  const kv: Record<string, unknown> = {};
  for (const [k, raw] of Object.entries(d.kv ?? {})) {
    try {
      kv[k] = JSON.parse(raw);
    } catch {
      // a slice that will not parse is treated as never saved
    }
  }
  const c = d.config;
  update((s) => {
    s.settings = JSON.parse(DEFAULT_SETTINGS);
    Object.assign(s.settings, { dark: theme.defaults.dark, wallpaper: theme.defaults.wallpaper, lockWallpaper: theme.defaults.lockWallpaper, frame: theme.defaults.frame });
    s.apps = [...theme.defaults.apps];
    s.dock = [...theme.defaults.dock];
    s.locked = true;
    s.app = null;
    s.call = null;
  });
  hydrate({ cfg: { map: c.map, upload: c.upload, mailDomain: c.mailDomain, garage: c.garage, unique: c.unique, admin: c.admin } });
  hydrate({
    ...kv,
    me: { name: d.name, number: d.number, handle: '', email: d.accounts?.mail ? `${d.accounts.mail}@${c.mailDomain}` : '' },
    chats: d.chats,
    calls: d.calls,
    // An empty Lua table arrives as [], whatever it was meant to be.
    accounts: Array.isArray(d.accounts) ? {} : d.accounts,
    places: (c.places ?? []).map((p, i) => ({ id: i + 1, name: p.name, kind: p.kind, wx: p.x, wy: p.y, ...mapPercent(p.x, p.y) })),
    songs: (c.songs ?? []).map((s, i) => ({ id: i + 1, title: s.title, artist: s.artist, album: s.album ?? '', dur: s.seconds ?? 180, seed: s.cover ?? i * 13 + 5, url: s.url })),
  });
  // Apps this server cannot back (no money, no jobs, no housing script...) are removed outright.
  for (const id of d.hidden ?? []) delete APPS[id];
  update((s) => {
    s.apps = s.apps.filter((id) => APPS[id]);
    s.dock = s.dock.filter((id) => APPS[id]);
    s.setup = kv.setup !== false;
  });
  setLocale(d.locale?.ui, d.locale?.intl);
  applySkin();
  setRtcConfig(c.rtc);
  markSaved();
}

type ShareItem = { kind: string; label: string; seed?: string; name?: string; number?: string; title?: string; body?: string; x?: number; y?: number };

/** Someone nearby sent something over AirShare: ask, then put it where it belongs. */
function receiveShare(from: string, item: ShareItem) {
  const accept = () => {
    if (item.kind === 'photo' && item.seed) addPhoto({ seed: item.seed });
    else if (item.kind === 'contact' && item.number) update((s) => s.contacts.push({ id: uid(), name: item.name ?? item.number!, number: item.number! }));
    else if (item.kind === 'note' || item.kind === 'text') update((s) => s.notes.unshift({ id: uid(), title: item.title ?? item.label, body: item.body ?? '', time: Date.now() }));
    else if (item.kind === 'location' && item.x != null && item.y != null) rpc('waypoint', { x: item.x, y: item.y });
    notify({ app: 'settings', title: 'AirShare', body: t('airshare_saved', { name: from }) });
  };
  alert({
    title: 'AirShare',
    message: t('airshare_offer', { name: from, what: item.label }),
    image: item.kind === 'photo' ? item.seed : undefined,
    buttons: [{ label: t('decline'), kind: 'cancel' }, { label: t('accept'), kind: 'bold', run: accept }],
  });
}

/** A message in a social DM, an anonymous channel or a match chat: append it and notify unless that app is open. */
function socialMsg(app: string, title: string, list: Msg[] | undefined, msg: Msg) {
  if (!list) return;
  update(() => list.push(msg));
  if (!(S.open && S.app === app)) notify({ app, title, body: msg.text ?? '' });
}

type Incoming =
  | { action: 'init'; data: Init }
  | { action: 'open' | 'close' | 'unload' }
  | { action: 'patch'; data: Record<string, unknown> }
  | { action: 'msg'; ch: number; members: string[]; name?: string; msg: Msg }
  | { action: 'call'; event: 'incoming' | 'answered' | 'ended'; number?: string; video?: boolean }
  | { action: 'notify'; app: string; title: string; body: string }
  | { action: 'refresh'; app: string }
  | { action: 'dm'; app: 'flock' | 'lumen'; user: string; msg: Msg }
  | { action: 'shade'; ch: number; msg: Msg }
  | { action: 'ember'; key: string; msg: Msg }
  | { action: 'live' | 'camera' }
  | { action: 'share'; from: string; item: ShareItem }
  | { action: 'addCustomApp'; app: CustomApp }
  | { action: 'removeCustomApp'; identifier: string }
  | { action: 'customAppMessage'; identifier: string; data: unknown }
  /** The active language: the "ui" section of config/locales/<code>.json and its "meta.intl". */
  | { action: 'setLocale'; ui: Strings; intl?: string }
  /** WebRTC: a handshake message relayed from another player, and the server's ICE/TURN servers. */
  | { action: 'rtc'; from: string; signal: Signal }
  | { action: 'rtcConfig'; config: RTCConfiguration };

export function listen() {
  window.addEventListener('message', (e: MessageEvent<Incoming>) => {
    const m = e.data;
    if (!m || typeof m !== 'object') return;
    switch (m.action) {
      case 'init':
        return init(m.data);
      case 'open':
        // The home screen's weather widget shows the game's weather, so it is re-read whenever the phone comes out.
        if (inGame && APPS.weather) loadApp('weather');
        return update((s) => (s.open = true));
      case 'close':
        return update((s) => (s.open = false));
      case 'unload':
        markSaved(false);
        return update((s) => ((s.open = false), (s.call = null)));
      case 'patch':
        return hydrate(m.data);
      case 'msg':
        return serverMsg(m);
      case 'call':
        if (m.event === 'incoming') return incomingCall(m.number ?? '', m.video);
        return m.event === 'answered' ? answered() : ended();
      case 'notify':
        return notify({ app: m.app, title: m.title, body: m.body });
      case 'refresh':
        if (S.app === m.app && S.loaded[m.app] === 'ready') loadApp(m.app);
        return;
      case 'dm': {
        let thread = S.dms[m.app].find((x) => x.user === m.user);
        if (!thread) update((s) => s.dms[m.app].unshift((thread = { id: uid(), user: m.user, msgs: [] })));
        return socialMsg(m.app, S.users[m.user]?.name ?? m.user, thread!.msgs, m.msg);
      }
      case 'shade': {
        const ch = S.shade.channels.find((c) => c.id === m.ch);
        return socialMsg('shade', `#${ch?.name ?? ''}`, ch?.msgs, m.msg);
      }
      case 'ember': {
        const match = S.matches.find((x) => x.key === m.key);
        return socialMsg('ember', match?.name ?? 'Ember', match?.msgs, m.msg);
      }
      case 'live':
      case 'camera':
        // Handled by whichever screen is showing (the live viewer, the camera).
        return void window.dispatchEvent(new CustomEvent(`phone:${m.action}`, { detail: m }));
      case 'share':
        return receiveShare(m.from, m.item);
      case 'addCustomApp': {
        const [ok, error] = addCustomApp(m.app);
        if (!ok) console.warn('[phone] AddCustomApp:', error);
        return;
      }
      case 'removeCustomApp':
        return void removeCustomApp(m.identifier);
      case 'customAppMessage':
        return void sendCustomAppMessage(m.identifier, m.data);
      case 'setLocale':
        setLocale(m.ui, m.intl);
        return applySkin();
      case 'rtc':
        return void signal(m.from, m.signal);
      case 'rtcConfig':
        return setRtcConfig(m.config);
    }
  });

  if (!inGame) return;
  // While a text field has focus the game must not also act on the keys (see client/main.lua).
  const field = (el: EventTarget | null) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
  document.addEventListener('focusin', (e) => field(e.target) && nuiFetch(null, 'typing', { on: true }));
  document.addEventListener('focusout', (e) => field(e.target) && nuiFetch(null, 'typing', { on: false }));
  window.addEventListener('keydown', (e) => e.key === 'Escape' && nuiFetch(null, 'close'));
  nuiFetch(null, 'ready');
}

/** Opening a conversation from a notification, by its server channel. */
export const openChat = (id: number) => openApp('messages', null, { chat: id });
