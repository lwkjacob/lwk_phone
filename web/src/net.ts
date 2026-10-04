/* Talking to the game. This module imports nothing from the app, so anything may import it.
 *
 * In FiveM the page runs inside the game (NUI): requests are POSTs to https://<resource>/<event>,
 * answered by Lua. In a browser there is no game, `inGame` is false, and every request resolves
 * to null so the UI keeps running on its mock data. */

export const inGame = 'GetParentResourceName' in window;

const resource = () => (window as unknown as { GetParentResourceName: () => string }).GetParentResourceName();

/** POST to an NUI callback of `target` (default: this resource). Null outside the game or on failure. */
export async function nuiFetch<T = unknown>(target: string | null, event: string, data: unknown = {}): Promise<T | null> {
  if (!inGame) {
    console.debug('[phone] nui ->', target ?? 'phone', event, data);
    return null;
  }
  try {
    const res = await fetch(`https://${target ?? resource()}/${event}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch {
    return null;
  }
}

/** What every server request answers: the fields it promised, or an error to show. */
export type Res<T = object> = ({ ok: true } & T) | ({ ok: false; error?: string } & Partial<T>);

/**
 * Ask the server (or the Lua client) to do something. See RPC[...] in server/*.lua and Local[...] in client/*.lua.
 * Resolves to null in the browser: callers treat that as "no server, the local change stands".
 */
export function rpc<T = object>(name: string, data: unknown = {}): Promise<Res<T> | null> {
  return nuiFetch<Res<T>>(null, 'rpc', { name, data });
}

/** Upload a file to the server's media host. Resolves to its public URL, or null when uploads are not set up. */
export async function upload(blob: Blob, filename: string): Promise<string | null> {
  const link = await rpc<{ url: string }>('upload');
  if (!link?.ok) return null;
  try {
    const form = new FormData();
    form.append('file', blob, filename);
    const res = await (await fetch(link.url, { method: 'POST', body: form })).json();
    return (res?.data?.url as string) ?? null;
  } catch {
    return null;
  }
}
