import { addCustomApp, removeCustomApp, type CustomApp } from './apps';
import { sendCustomAppMessage } from './apps/Custom';

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

type Incoming =
  | { action: 'addCustomApp'; app: CustomApp }
  | { action: 'removeCustomApp'; identifier: string }
  | { action: 'customAppMessage'; identifier: string; data: unknown };

/** Messages the three custom-app exports send: AddCustomApp, RemoveCustomApp, SendCustomAppMessage. */
export function listen() {
  window.addEventListener('message', (e: MessageEvent<Incoming>) => {
    const m = e.data;
    if (!m || typeof m !== 'object') return;
    if (m.action === 'addCustomApp') {
      const [ok, error] = addCustomApp(m.app);
      if (!ok) console.warn('[phone] AddCustomApp:', error);
    } else if (m.action === 'removeCustomApp') removeCustomApp(m.identifier);
    else if (m.action === 'customAppMessage') sendCustomAppMessage(m.identifier, m.data);
  });
}
