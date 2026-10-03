import { addCustomApp, applySkin, removeCustomApp, type CustomApp } from './apps';
import { sendCustomAppMessage } from './apps/Custom';
import { setLocale, type Strings } from './i18n';
import { S, update } from './store';

/* The bridge to the game. Lua talks to the phone with SendNUIMessage({ action = ..., ... });
 * the phone talks back by POSTing to https://<resource>/<event>. Outside FiveM both ends are faked:
 * the DevPanel posts the same messages, and outgoing calls are logged instead of sent. */

export const inGame = 'GetParentResourceName' in window;

export async function nuiFetch<T = unknown>(resource: string | null, event: string, data: unknown = {}): Promise<T | null> {
  if (!inGame) {
    console.debug('[phone] nui ->', resource ?? 'phone', event, data);
    return null;
  }
  const target = resource ?? (window as unknown as { GetParentResourceName: () => string }).GetParentResourceName();
  const res = await fetch(`https://${target}/${event}`, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(data) });
  return res.json();
}

/**
 * Fetch what an app needs before it can draw. In-game the reply is merged into the store
 * (same shapes as data.ts). The browser has the mock data already, so it only simulates the wait.
 */
export async function loadApp(id: string) {
  update((s) => (s.loaded[id] = 'loading'));
  try {
    if (S.settings.airplane) throw new Error('offline');
    if (inGame) Object.assign(S, await nuiFetch<Partial<typeof S>>(null, 'appData', { app: id }));
    else {
      await new Promise((r) => window.setTimeout(r, S.net === 'fast' ? 0 : 1400));
      if (S.net === 'fail') throw new Error('simulated failure');
    }
    update((s) => (s.loaded[id] = 'ready'));
  } catch {
    update((s) => (s.loaded[id] = 'error'));
  }
}

type Incoming =
  | { action: 'addCustomApp'; app: CustomApp }
  | { action: 'removeCustomApp'; identifier: string }
  | { action: 'customAppMessage'; identifier: string; data: unknown }
  /** The active language: the "ui" section of config/locales/<code>.json and its "meta.intl". */
  | { action: 'setLocale'; ui: Strings; intl?: string };

/** Messages from Lua: the three custom-app exports (AddCustomApp, RemoveCustomApp, SendCustomAppMessage) and the language. */
export function listen() {
  window.addEventListener('message', (e: MessageEvent<Incoming>) => {
    const m = e.data;
    if (!m || typeof m !== 'object') return;
    if (m.action === 'addCustomApp') {
      const [ok, error] = addCustomApp(m.app);
      if (!ok) console.warn('[phone] AddCustomApp:', error);
    } else if (m.action === 'removeCustomApp') removeCustomApp(m.identifier);
    else if (m.action === 'customAppMessage') sendCustomAppMessage(m.identifier, m.data);
    else if (m.action === 'setLocale') {
      setLocale(m.ui, m.intl);
      applySkin();
    }
  });
}
