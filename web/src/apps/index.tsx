import type { ComponentType, ReactNode } from 'react';
import { Aperture, AudioLines, Calculator, Camera, CarFront, CloudSun, Coins, Feather, Flame, Ghost, House, LayoutGrid, Mail, Megaphone, MessageCircle, Music, Navigation, Phone, Play, Settings, Siren, Store } from 'lucide-react';
import { t } from '../i18n';
import { nuiFetch } from '../nui';
import { S, actionApps, update } from '../store';
import { applyTheme, theme, type ThemeFile } from '../theme';
import { ClockFace } from '../ui';
import { ClockApp } from './Clock';
import { CryptoApp } from './Crypto';
import { CustomAppView } from './Custom';
import { EmberApp } from './Ember';
import { FlockApp } from './Flock';
import { GarageApp, HomeApp, ServicesApp, WalletApp } from './Life';
import { AdvertsApp, MarketApp } from './Listings';
import { LoopApp } from './Loop';
import { LumenApp } from './Lumen';
import { MailApp } from './Mail';
import { MapsApp } from './Maps';
import { satellite } from '../tiles';
import { CameraApp, PhotosApp } from './Media';
import { MessagesApp } from './Messages';
import { MusicApp } from './Music';
import { PhoneApp } from './Phone';
import { SettingsApp } from './Settings';
import { ShadeApp } from './Shade';
import { gated } from './social';
import { StoreApp } from './Store';
import { CalculatorApp, MemosApp, NotesApp, WeatherApp } from './Utilities';

export type AppDef = {
  id: string;
  name: string;
  /** Icon background and glyph. All artwork is original: no vendor marks. */
  bg: string;
  fg?: string;
  glyph: ReactNode;
  /** Image URL shown instead of the glyph (skins, community apps). */
  icon?: string;
  view: ComponentType;
  /** Always dark, whatever the system appearance. */
  dark?: boolean;
  /** Status bar text colour when it must differ from the theme. */
  bar?: 'light' | 'dark';
  /** Built in: cannot be removed. */
  system?: boolean;
  /** One of the ten apps that ship installed. Everything else is an add-on from the App Store. */
  core?: boolean;
  /** Needs data from the server before it can draw; the value picks the placeholder shown while it loads. */
  data?: 'list' | 'grid' | 'feed';
  /** Set on apps another resource registered at runtime. */
  custom?: CustomApp;
  cat: string;
  desc: string;
};

const fill = { fill: 'currentColor', strokeWidth: 0 };
const grad = (a: string, b: string) => `linear-gradient(180deg, ${a}, ${b})`;

const list: AppDef[] = [
  { id: 'phone', name: 'Phone', bg: grad('#62f07b', '#0cbf2e'), glyph: <Phone {...fill} />, view: PhoneApp, system: true, core: true, data: 'list', cat: 'Utilities', desc: 'Calls, contacts, favourites and voicemail.' },
  { id: 'messages', name: 'Messages', bg: grad('#62f07b', '#0cbf2e'), glyph: <MessageCircle {...fill} />, view: MessagesApp, system: true, core: true, data: 'list', cat: 'Social', desc: 'Text, photos, locations, voice notes and money, one to one or in groups.' },
  { id: 'camera', name: 'Camera', bg: grad('#e6e6eb', '#b4b5bb'), fg: '#2c2c2e', glyph: <Camera fill="currentColor" stroke="#cdced3" />, view: CameraApp, dark: true, system: true, core: true, cat: 'Photo & Video', desc: 'Photos, selfies and video.' },
  { id: 'music', name: 'Music', bg: grad('#ff6482', '#f3193d'), glyph: <Music strokeWidth={2.6} />, view: MusicApp, data: 'list', cat: 'Music', desc: 'Songs and playlists, with controls on the Lock Screen and in Control Center.' },
  { id: 'photos', name: 'Photos', bg: '#fff', glyph: <i className="g-photos" />, view: PhotosApp, system: true, core: true, data: 'grid', cat: 'Photo & Video', desc: 'Your library, albums and favourites.' },
  { id: 'mail', name: 'Mail', bg: grad('#3aa9ff', '#1763ee'), glyph: <Mail fill="currentColor" stroke="#2a86f6" />, view: gated('mail', MailApp), data: 'list', cat: 'Productivity', desc: 'Send and receive email around the city.' },
  { id: 'clock', name: 'Clock', bg: '#0b0b0c', glyph: <ClockFace size={52} numbers />, view: ClockApp, dark: true, system: true, cat: 'Utilities', desc: 'World clock, alarms, stopwatch and timers.' },
  { id: 'weather', name: 'Weather', bg: grad('#2271e3', '#62c8fc'), glyph: <CloudSun fill="currentColor" />, view: WeatherApp, bar: 'light', data: 'feed', cat: 'Weather', desc: 'Current conditions and the week ahead.' },
  { id: 'maps', name: 'Maps', bg: 'linear-gradient(135deg, #6fd97a 0 51%, #46a6f7 53%)', glyph: <Navigation {...fill} />, view: MapsApp, /* light text over the satellite picture, dark over the road map */ get bar() { return satellite() ? ('light' as const) : ('dark' as const); }, core: true, cat: 'Navigation', desc: 'Find places, set waypoints and share where you are.' },
  { id: 'notes', name: 'Notes', bg: 'linear-gradient(180deg, #ffd43a 0 30%, #fdfdfb 30%)', glyph: <i className="g-notes" />, view: NotesApp, data: 'list', cat: 'Productivity', desc: 'Quick notes you can share nearby.' },
  { id: 'calc', name: 'Calculator', bg: '#1c1c1e', fg: '#ff9f0a', glyph: <Calculator strokeWidth={2.2} />, view: CalculatorApp, dark: true, cat: 'Utilities', desc: 'A four-function calculator.' },
  { id: 'memos', name: 'Voice Memos', bg: '#0b0b0c', fg: '#ff453a', glyph: <AudioLines strokeWidth={2.6} />, view: MemosApp, dark: true, data: 'list', cat: 'Utilities', desc: 'Record, replay and share audio.' },
  { id: 'wallet', name: 'Wallet', bg: '#0b0b0c', glyph: <i className="g-wallet" />, view: WalletApp, core: true, data: 'list', cat: 'Finance', desc: 'Your bank card, balance, licence and transfers.' },
  { id: 'home', name: 'Home', bg: '#fff', fg: '#ff9500', glyph: <House {...fill} />, view: HomeApp, data: 'feed', cat: 'Lifestyle', desc: 'Lock your properties and hand out keys.' },
  { id: 'garage', name: 'Garage', bg: grad('#565b66', '#23262c'), glyph: <CarFront strokeWidth={2.2} />, view: GarageApp, core: true, data: 'list', cat: 'Lifestyle', desc: 'Track your vehicles, call a valet, pay impound fees.' },
  { id: 'services', name: 'Services', bg: grad('#ff8a5c', '#e6412b'), glyph: <Siren strokeWidth={2.4} />, view: ServicesApp, core: true, data: 'list', cat: 'Business', desc: 'Reach police, EMS, mechanics and more. Manage your own company.' },
  { id: 'store', name: 'App Store', bg: grad('#1fc8ff', '#1a6df4'), glyph: <LayoutGrid {...fill} />, view: StoreApp, system: true, core: true, cat: 'Utilities', desc: 'Install and remove apps.' },
  { id: 'settings', name: 'Settings', bg: grad('#b9bcc4', '#70747c'), glyph: <Settings strokeWidth={2.2} />, view: SettingsApp, system: true, core: true, cat: 'Utilities', desc: 'Appearance, sounds, security and more.' },
  { id: 'flock', name: 'Flock', bg: grad('#3ebcff', '#0a84ff'), glyph: <Feather strokeWidth={2.4} />, view: gated('flock', FlockApp), data: 'feed', cat: 'Social', desc: 'Short posts from the whole city. Reply, repost, follow trends.' },
  { id: 'lumen', name: 'Lumen', bg: 'linear-gradient(45deg, #ffb53e, #ff3d77 55%, #8a3ffc)', glyph: <Aperture strokeWidth={2.4} />, view: gated('lumen', LumenApp), data: 'feed', cat: 'Photo & Video', desc: 'Share photos and stories, or go live to your followers.' },
  { id: 'loop', name: 'Loop', bg: '#0b0b0c', glyph: <Play {...fill} className="g-loop" />, view: gated('loop', LoopApp), dark: true, data: 'feed', cat: 'Entertainment', desc: 'Endless short videos. Post your own clips.' },
  { id: 'adverts', name: 'Adverts', bg: grad('#ffd84a', '#ffae00'), fg: '#1c1c1e', glyph: <Megaphone fill="currentColor" stroke="#ffc21a" />, view: AdvertsApp, data: 'feed', cat: 'Business', desc: 'Classified ads with a number to call.' },
  { id: 'market', name: 'Market', bg: grad('#4a8cff', '#2350d8'), glyph: <Store strokeWidth={2.2} />, view: MarketApp, data: 'grid', cat: 'Shopping', desc: 'Buy and sell items with people nearby.' },
  { id: 'crypto', name: 'Crypto', bg: '#111113', fg: '#f7931a', glyph: <Coins strokeWidth={2.2} />, view: CryptoApp, dark: true, data: 'list', cat: 'Finance', desc: 'Track prices, buy and sell coins from your bank balance.' },
  { id: 'ember', name: 'Ember', bg: 'linear-gradient(160deg, #ff8a3c, #ff2d6b)', glyph: <Flame {...fill} />, view: EmberApp, data: 'feed', cat: 'Lifestyle', desc: 'Swipe, match and chat with people around you.' },
  { id: 'shade', name: 'Shade', bg: '#111113', fg: '#a78bfa', glyph: <Ghost fill="currentColor" stroke="#111113" />, view: gated('shade', ShadeApp), dark: true, data: 'list', cat: 'Social', desc: 'Anonymous channels. No names, no numbers.' },
];

export const APPS: Record<string, AppDef> = Object.fromEntries(list.map((a) => [a.id, a]));

const BUILT_IN = Object.fromEntries(list.map((a) => [a.id, { bg: a.bg, fg: a.fg, icon: a.icon, cat: 'cat_' + a.cat.toLowerCase().replace(/[^a-z0-9]+/g, '_') }]));

/** Apply a theme file: colours, wallpapers and defaults, plus any per-app renames and icons.
 *  Also (re)reads app names, descriptions and categories from the active language, so call it after setLocale. */
export function applySkin(file?: ThemeFile) {
  if (file) applyTheme(file);
  for (const id of Object.keys(BUILT_IN)) {
    // In-game, apps the server cannot back are removed (see init in nui.ts).
    if (!APPS[id]) continue;
    const { cat, ...look } = BUILT_IN[id];
    Object.assign(APPS[id], look, { name: t(`app_${id}`), desc: t(`app_${id}_desc`), cat: t(cat) }, theme.apps[id]);
  }
  update();
}

/* ---------- community apps (AddCustomApp / RemoveCustomApp) ---------- */

/** What a resource passes to the AddCustomApp export. Field names match LB Phone's. */
export type CustomApp = {
  identifier: string;
  name: string;
  description?: string;
  developer?: string;
  /** Installed for everyone without a trip to the App Store. */
  defaultApp?: boolean;
  /** Size in kB, shown in the App Store. */
  size?: number;
  /** Screenshots for the App Store page. */
  images?: string[];
  /** "resource-name/ui/index.html". Leave out for an app that only runs a function when tapped. */
  ui?: string;
  icon?: string;
  /** Open sideways, for games and video. */
  landscape?: boolean;
  /** In-game money charged on install. */
  price?: number;
  /** Apps without a UI close the phone when tapped unless this is set. */
  keepOpen?: boolean;
};

const isInstalled = (id: string) => S.apps.includes(id) || S.dock.includes(id);

/** Tell the game an app was used, installed or deleted, so the owning resource's Lua callbacks can run. */
export const appEvent = (id: string, event: 'use' | 'install' | 'delete') => void (APPS[id]?.custom && nuiFetch(null, 'customApp', { identifier: id, event }));

export function addCustomApp(app: CustomApp): [ok: boolean, error?: string] {
  const id = app?.identifier;
  if (!id || !app.name) return [false, 'identifier and name are required'];
  if (APPS[id] && !APPS[id].custom) return [false, `"${id}" is a built-in app`];
  APPS[id] = {
    id,
    name: app.name,
    bg: 'linear-gradient(180deg, #5b6170, #2e323b)',
    glyph: <b className="g-letter">{app.name[0].toUpperCase()}</b>,
    icon: app.icon,
    view: () => <CustomAppView id={id} />,
    cat: app.developer ?? 'Community',
    desc: app.description ?? '',
    custom: app,
  };
  if (app.ui) actionApps.delete(id);
  else actionApps.set(id, () => (appEvent(id, 'use'), app.keepOpen || update((s) => (s.open = false))));
  update((s) => app.defaultApp && !isInstalled(id) && s.apps.push(id));
  return [true];
}

export function removeCustomApp(id: string): [ok: boolean, error?: string] {
  if (!APPS[id]?.custom) return [false, `no community app "${id}"`];
  // Take it off the home screen and close it first, then drop the definition.
  update((s) => {
    s.apps = s.apps.filter((x) => x !== id);
    s.dock = s.dock.filter((x) => x !== id);
    s.notifs = s.notifs.filter((n) => n.app !== id);
    if (s.app === id) {
      s.app = null;
      s.closing = false;
    }
  });
  delete APPS[id];
  actionApps.delete(id);
  update();
  return [true];
}

export function AppIcon({ id, size = 60 }: { id: string; size?: number }) {
  const a = APPS[id];
  if (!a) return null;
  return (
    <span className="app-ic" style={{ width: size, height: size, borderRadius: size * theme.iconRadius, background: a.bg, color: a.fg ?? '#fff' }} aria-hidden="true">
      {a.icon ? <img src={a.icon} alt="" /> : a.glyph}
    </span>
  );
}
