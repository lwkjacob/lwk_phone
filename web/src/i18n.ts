// Named import: only the "ui" section is bundled.
import { ui as enUi } from '../../config/locales/en.json';

/* UI strings come from config/locales/<code>.json -> "ui", the same layout lwk_bank uses.
 * The game sends the active language; anything missing falls back to the bundled English,
 * then to the key itself. Placeholders look like {name}. */

export type Strings = Record<string, string>;

const FALLBACK: Strings = enUi;
let strings = FALLBACK;

/** Intl locale for dates and numbers, e.g. 'de-DE'. From the locale file's "meta.intl". */
export let intl = 'en-US';

export function setLocale(ui?: Strings, code?: string) {
  strings = { ...FALLBACK, ...ui };
  intl = code && Intl.DateTimeFormat.supportedLocalesOf(code).length ? code : 'en-US';
}

export function t(key: string, vars?: Record<string, unknown>): string {
  let out = strings[key] ?? key;
  // false / null / undefined print as nothing, so `{x && ...}` style values can be passed straight in.
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v == null || v === false ? '' : String(v));
  return out;
}

/** Dev aid: every translatable string gets brackets and accents, so anything still plain is hard-coded. */
export function pseudoLocale(): Strings {
  const map: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', A: 'Á', E: 'É', O: 'Ó' };
  const twist = (s: string) => s.replace(/\{[a-zA-Z0-9]+\}|[aeiouAEO]/g, (m) => (m.length > 1 ? m : map[m]));
  return Object.fromEntries(Object.entries(FALLBACK).map(([k, v]) => [k, `[${twist(v)}]`]));
}
