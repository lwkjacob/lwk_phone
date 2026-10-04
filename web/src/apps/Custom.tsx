import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { inGame, upload } from '../net';
import { nuiFetch } from '../nui';
import { S, actions, addPhoto, alert, notify, openApp, share, startCall, update, useS } from '../store';
import { ColorSheet, EmojiSheet, GifSheet } from '../pickers';
import { picUrl } from '../ui';
import { APPS } from './index';
import { PhotoPicker } from './Media';
import { t } from '../i18n';
import type { Photo, Seed } from '../data';

/* Community apps, the same way LB Phone does them: another resource registers an app with a path to
 * its own HTML page, the phone shows that page in an iframe and hands it a set of globals
 * (fetchNui, components.setPopUp, ...). The API names and shapes follow LB's so existing apps port over. */

type PopUpButton = { title: string; color?: string; bold?: boolean; cb?: (value?: string) => void };
type PopUp = { title: string; description?: string; attachment?: { src: string }; input?: { placeholder?: string; defaultValue?: string; onChange?: (v: string) => void }; buttons: PopUpButton[] };
type GalleryItem = { id: number; src: string; isVideo: boolean };
type GalleryOpts = { includeVideos?: boolean; includeImages?: boolean; multiSelect?: boolean; onSelect: (data: GalleryItem | GalleryItem[]) => void };
type Contact = { firstname: string; lastname: string; number: string; name: string };

const frames = new Map<string, Window>();

/** SendCustomAppMessage: deliver a message to an app's page. Only reaches an app that is open. */
export function sendCustomAppMessage(id: string, data: unknown) {
  frames.get(id)?.postMessage(data, '*');
  return frames.has(id);
}

const settingsFor = () => ({
  display: { theme: S.settings.dark ? 'dark' : 'light', size: S.settings.size },
  airplaneMode: S.settings.airplane,
  streamerMode: S.settings.streamer,
  doNotDisturb: S.settings.dnd,
  sound: { volume: S.settings.volume, silent: S.settings.silent },
  time: { twelveHourClock: !S.settings.clock24 },
  name: S.me.name,
  phoneNumber: S.me.number,
});

/** "resource/ui/index.html" is served by FiveM from that resource; anything URL-like is used as is. */
const isUrl = (ui: string) => /^(https?:|\.{0,2}\/)/.test(ui);
const uiUrl = (ui: string) => (isUrl(ui) ? ui : `https://cfx-nui-${ui}`);

export function CustomAppView({ id }: { id: string }) {
  const s = useS();
  const frame = useRef<HTMLIFrameElement>(null);
  const watchers = useRef<((settings: ReturnType<typeof settingsFor>) => void)[]>([]);
  const [gallery, setGallery] = useState<GalleryOpts | null>(null);
  const [full, setFull] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ kind: 'emoji' | 'gif' | 'color'; run: (value: string) => void } | null>(null);
  const app = APPS[id]?.custom;
  const theme = s.settings.dark ? 'dark' : 'light';

  useEffect(() => {
    nuiFetch(null, 'customApp', { identifier: id, event: 'open' });
    if (APPS[id]?.custom?.landscape) update((x) => (x.landscape = true));
    return () => {
      frames.delete(id);
      update((x) => (x.hideHomeBar = false));
      nuiFetch(null, 'customApp', { identifier: id, event: 'close' });
    };
  }, [id]);

  // Keep the app's page in step with the phone's appearance and settings.
  useEffect(() => {
    try {
      const doc = frame.current?.contentDocument;
      if (doc) doc.documentElement.dataset.theme = theme;
    } catch {
      // cross-origin page outside FiveM: it can still read settings through onSettingsChange
    }
    watchers.current.forEach((cb) => cb(settingsFor()));
  }, [theme, s.settings.airplane, s.settings.streamer, s.settings.dnd, s.settings.clock24]);

  if (!app?.ui) return null;
  const resource = isUrl(app.ui) ? 'dev' : app.ui.split('/')[0];

  const unavailable = (name: string) => () => {
    console.warn(`[phone] components.${name} is not available yet`);
    return Promise.reject(new Error(`${name} is not available yet`));
  };

  const onLoad = () => {
    const w = frame.current?.contentWindow as (Window & Record<string, unknown>) | null | undefined;
    if (!w) return;
    frames.set(id, w);
    watchers.current = [];
    const api = {
      resourceName: resource,
      appName: app.name,
      appIdentifier: id,
      settings: settingsFor(),
      fetchNui: (event: string, data?: unknown, scriptName?: string) => nuiFetch(scriptName ?? resource, event, data),
      onNuiEvent: (event: string, cb: (data: unknown) => void) => w.addEventListener('message', (e: MessageEvent) => e.data?.action === event && cb(e.data.data)),
      onSettingsChange: (cb: (settings: ReturnType<typeof settingsFor>) => void) => void watchers.current.push(cb),
      sendNotification: (n: { title?: string; content?: string }) => notify({ app: id, title: n.title ?? app.name, body: n.content ?? '' }),
      createCall: (c: { number?: string | number; videoCall?: boolean }) => c.number != null && startCall(String(c.number), !!c.videoCall),
      formatPhoneNumber: (n: string | number) => String(n),
      setApp: (target: string | { name: string }) => {
        const name = (typeof target === 'string' ? target : target.name).toLowerCase();
        const key = Object.keys(APPS).find((k) => k.toLowerCase() === name || APPS[k].name.toLowerCase() === name);
        if (key) openApp(key);
      },
      components: {
        setPopUp: (p: PopUp) =>
          alert({
            title: p.title,
            message: p.description,
            image: p.attachment?.src,
            input: p.input ? (p.input.placeholder ?? '') : undefined,
            value: p.input?.defaultValue,
            buttons: p.buttons.map((b) => ({
              label: b.title,
              kind: b.color === 'red' ? 'destructive' : b.bold ? 'bold' : undefined,
              run: (v) => (p.input?.onChange?.(v), b.cb?.(v)),
            })),
          }),
        setContextMenu: (m: { title?: string; buttons: PopUpButton[] }) => actions({ title: m.title, options: m.buttons.map((b) => ({ label: b.title, destructive: b.color === 'red', run: () => b.cb?.() })) }),
        // ponytail: reuses the action sheet, so only the first ten contacts are offered. Swap for a searchable sheet when lists get long.
        setContactSelector: (o: { onSelect: (c: Contact) => void }) =>
          actions({
            title: t('contacts'),
            options: S.contacts.slice(0, 10).map((c) => ({ label: c.name, run: () => o.onSelect({ firstname: c.name.split(' ')[0], lastname: c.name.split(' ').slice(1).join(' '), number: c.number, name: c.name }) })),
          }),
        setShareComponent: (o: { type?: string; data?: { title?: string; src?: string } }) => share({ kind: o.type === 'image' ? t('kind_photo') : (o.type ?? app.name), label: o.data?.title ?? app.name }),
        setGallery: (o: GalleryOpts) => setGallery(o),
        setFullscreenImage: (src: string | null) => setFull(src),
        setHomeIndicatorVisible: (visible: boolean) => update((x) => (x.hideHomeBar = !visible)),
        saveToGallery: (url?: string) => Promise.resolve(addPhoto(inGame && typeof url === 'string' ? { seed: url } : {}).id),
        // Same call as LB Phone: resolves to the hosted URL. Rejects when the server has no media host set up.
        uploadMedia: async (type: string, blob: Blob) => {
          if (!inGame) return URL.createObjectURL(blob);
          const url = await upload(blob, type === 'Video' ? 'video.webm' : type === 'Audio' ? 'audio.webm' : 'image.jpg');
          if (!url) throw new Error('uploads are not set up on this server');
          return url;
        },
        // Needs a renderer the phone does not hand to apps yet.

        createGameRender: unavailable('createGameRender'),
        setColorPicker: (o: { onSelect?: (color: string) => void; onClose?: (color: string) => void }) => setPicker({ kind: 'color', run: (c) => (o.onSelect?.(c), o.onClose?.(c)) }),
        // Both take options to open, or `false` to close, as in LB Phone.
        setEmojiPickerVisible: (o: false | { onSelect: (e: { emoji: string }) => void }) => setPicker(o ? { kind: 'emoji', run: (emoji) => o.onSelect({ emoji }) } : null),
        setGifPickerVisible: (o: false | { onSelect: (gif: string) => void }) => setPicker(o ? { kind: 'gif', run: o.onSelect } : null),
      },
    };
    try {
      Object.assign(w, api);
      w.document.documentElement.dataset.theme = theme;
      // Room for the status bar and home indicator, which draw over the app.
      // Sideways the camera cut-out is on the left and there is no status bar.
      w.document.documentElement.style.setProperty('--safe-top', app.landscape ? '0px' : '54px');
      w.document.documentElement.style.setProperty('--safe-bottom', app.landscape ? '21px' : '34px');
      w.document.documentElement.style.setProperty('--safe-left', app.landscape ? '54px' : '0px');
    } catch (err) {
      console.warn(`[phone] could not reach the page of "${id}" to hand it the phone API`, err);
    }
    // Same signal LB sends: the page can start using the globals once it sees this.
    w.postMessage('componentsLoaded', '*');
  };

  const pick = (seed: Seed, p: Photo) => {
    // In-game `src` is the hosted URL. The browser demo has no real photos, so it hands over a generated image.
    const item = { id: p.id, src: p.src ?? picUrl(seed), isVideo: !!p.video };
    gallery?.onSelect(gallery.multiSelect ? [item] : item);
  };

  return (
    <>
      <iframe ref={frame} className="custom-app" title={app.name} src={uiUrl(app.ui)} onLoad={onLoad} />
      {gallery && <PhotoPicker videos={!!gallery.includeVideos && gallery.includeImages === false} onPick={pick} onClose={() => setGallery(null)} />}
      {picker?.kind === 'emoji' && <EmojiSheet onPick={picker.run} onClose={() => setPicker(null)} />}
      {picker?.kind === 'gif' && <GifSheet onPick={(seed) => picker.run(picUrl(seed))} onClose={() => setPicker(null)} />}
      {picker?.kind === 'color' && <ColorSheet onPick={picker.run} onClose={() => setPicker(null)} />}
      {full && (
        <div className="fullimg" role="dialog" aria-label={t('custom_image')}>
          <img src={full} alt="" />
          <button aria-label={t('close')} onClick={() => setFull(null)}>
            <X size={22} />
          </button>
        </div>
      )}
    </>
  );
}
