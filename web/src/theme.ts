import base from './theme.default.json';
import { S } from './store';

/* The look of the phone as data. theme.default.json is the built-in skin; a server drops its own
 * web/theme.json beside index.html (any subset of these keys) and it is laid over the default at startup.
 * No rebuild needed: the file is fetched at runtime. */

export type AppSkin = { name?: string; bg?: string; fg?: string; icon?: string };
export type Theme = {
  name: string;
  /** CSS font stack. The font must already be available: a system font, or the bundled Inter. */
  font: string;
  /** Icon corner radius as a fraction of icon size: 0.225 is a rounded square, 0.5 a circle. */
  iconRadius: number;
  /** Camera cut-out: a wide pill, or a small punch hole that only widens for calls and music. */
  island: string;
  /** Frame colours offered in Settings: id -> CSS colour. */
  frames: Record<string, string>;
  /** Wallpapers offered in Settings: id -> any CSS background-image value. */
  wallpapers: Record<string, string>;
  /** Overrides for the colour tokens in styles/base.css, per appearance, e.g. { "--blue": "#0b8a7a" }. */
  colors: { light: Record<string, string>; dark: Record<string, string> };
  /** Per-app renames and icon changes, keyed by app id. `icon` is an image URL that replaces the glyph. */
  apps: Record<string, AppSkin>;
  /** What a fresh phone starts with. */
  defaults: { dark: boolean; wallpaper: string; lockWallpaper: string; frame: string; apps: string[]; dock: string[] };
};
export type ThemeFile = Partial<Omit<Theme, 'colors' | 'defaults'>> & { colors?: Partial<Theme['colors']>; defaults?: Partial<Theme['defaults']> };

const BASE: Theme = base;
export let theme = BASE;

const tag = document.createElement('style');
const vars = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k}:${v}`).join(';');
let first = true;

export function applyTheme(over: ThemeFile = {}) {
  theme = {
    ...BASE,
    ...over,
    frames: { ...BASE.frames, ...over.frames },
    wallpapers: { ...BASE.wallpapers, ...over.wallpapers },
    colors: { light: { ...BASE.colors.light, ...over.colors?.light }, dark: { ...BASE.colors.dark, ...over.colors?.dark } },
    apps: { ...BASE.apps, ...over.apps },
    defaults: { ...BASE.defaults, ...over.defaults },
  };
  tag.textContent = [
    `:root{--font:${theme.font}}`,
    ...Object.entries(theme.wallpapers).map(([id, bg]) => `[data-wall="${id}"]{background-image:${bg}}`),
    ...Object.entries(theme.frames).map(([id, color]) => `.phone-body[data-frame="${id}"]{--frame:${color}}`),
    `[data-theme="light"]{${vars(theme.colors.light)}}`,
    `[data-theme="dark"]{${vars(theme.colors.dark)}}`,
  ].join('\n');
  // Re-append so these rules always sit after the app's own stylesheet.
  document.head.appendChild(tag);

  const d = theme.defaults;
  Object.assign(S.settings, { dark: d.dark, wallpaper: d.wallpaper, lockWallpaper: d.lockWallpaper, frame: d.frame });
  // The installed-app list is only a starting point: switching skins later must not uninstall anything.
  if (first) {
    S.apps = [...d.apps];
    S.dock = [...d.dock];
  }
  first = false;
}

/** Fetch a theme file. A missing or broken file is not an error: the built-in skin is used. */
export async function fetchTheme(url: string): Promise<ThemeFile> {
  try {
    const res = await fetch(url);
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}
