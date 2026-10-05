import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { gameView } from '../gameview';
import { inGame, upload } from '../net';
import { nuiFetch } from '../nui';
import { S, actions, addPhoto, alert, goHome, notify, openApp, share, startCall, update, useS } from '../store';
import { ColorSheet, EmojiSheet, GifSheet } from '../pickers';
import { picUrl } from '../ui';
import { APPS } from './index';
import { PhotoPicker } from './Media';
import { intl, t } from '../i18n';
import type { Photo, Seed } from '../data';

/* Community apps, the same way LB Phone does them: another resource registers an app with a path to
 * its own HTML page, the phone shows that page in an iframe and hands it a set of globals
 * (fetchNui, components.setPopUp, ...). The API names and shapes follow LB's so existing apps port over. */

type PopUpButton = { title: string; color?: string; bold?: boolean; cb?: (value?: string) => void };
type PopUp = { title: string; description?: string; attachment?: { src: string }; input?: { placeholder?: string; value?: string; defaultValue?: string; onChange?: (v: string) => void }; buttons: PopUpButton[] };
type GalleryItem = { id: number; src: string; isVideo: boolean };
type GalleryOpts = { includeVideos?: boolean; includeImages?: boolean; multiSelect?: boolean; onSelect: (data: GalleryItem | GalleryItem[]) => void };
type Contact = { firstname: string; lastname: string; number: string; name: string };

type Menu = { title?: string; buttons: PopUpButton[] };

const frames = new Map<string, Window>();

/** A pop-up in the shape community apps describe one. */
export function showPopUp(p: PopUp & { inputs?: PopUp['input'][] }) {
  const input = p.input ?? p.inputs?.[0];
  alert({
    title: p.title,
    message: p.description,
    image: p.attachment?.src,
    input: input ? (input.placeholder ?? '') : undefined,
    value: input?.value ?? input?.defaultValue,
    buttons: p.buttons.map((b) => ({
      label: b.title,
      kind: b.color === 'red' ? 'destructive' : b.bold ? 'bold' : undefined,
      run: (v) => (input?.onChange?.(v), b.cb?.(v)),
    })),
  });
}

export const showContextMenu = (m: Menu) => actions({ title: m.title, options: m.buttons.map((b) => ({ label: b.title, destructive: b.color === 'red', run: () => b.cb?.() })) });

/** Names apps written for other phones use for the built-in apps. */
const ALIASES: Record<string, string> = {
  appstore: 'store', calculator: 'calc', voicememo: 'memos', voicememos: 'memos', birdy: 'flock', twitter: 'flock', instapic: 'lumen', instagram: 'lumen',
  trendy: 'loop', tiktok: 'loop', spark: 'ember', tinder: 'ember', darkchat: 'shade', yellowpages: 'adverts', pages: 'adverts', marketplace: 'market',
};

/** Open an app by id or by name, whichever the caller knows. */
export function openByName(target: string | { name: string }) {
  const name = (typeof target === 'string' ? target : target.name).toLowerCase().replace(/\s+/g, '');
  const key = APPS[ALIASES[name]] ? ALIASES[name] : Object.keys(APPS).find((k) => k.toLowerCase() === name || APPS[k].name.toLowerCase().replace(/\s+/g, '') === name);
  if (key) openApp(key);
}

/** A page inside a community app asks to be closed (its own Escape or Back handling). */
export function closeFromFrame(source: MessageEventSource | null) {
  for (const [id, w] of frames) if (w === source && S.app === id) goHome();
}

/** SendCustomAppMessage: deliver a message to an app's page. Only reaches an app that is open. */
export function sendCustomAppMessage(id: string, data: unknown) {
  frames.get(id)?.postMessage(data, '*');
  return frames.has(id);
}

const settingsFor = () => ({
  display: { theme: S.settings.dark ? 'dark' : 'light', size: S.settings.size, brightness: S.settings.brightness, automatic: false, frameColor: S.settings.frameColor },
  airplaneMode: S.settings.airplane,
  streamerMode: S.settings.streamer,
  doNotDisturb: S.settings.dnd,
  locale: intl.slice(0, 2),
  sound: { volume: S.settings.volume, silent: S.settings.silent, ringtone: S.settings.ringtone, texttone: S.settings.texttone },
  time: { twelveHourClock: !S.settings.clock24 },
  security: { pinCode: !!S.settings.passcode, faceId: S.settings.faceId },
  wallpaper: { background: S.settings.wallpaper },
  weather: { celcius: true },
  phone: { showCallerId: !S.settings.hideCallerId },
  apps: [[...S.dock], [...S.apps]],
  name: S.me.name,
  email: S.me.email,
  phoneNumber: S.me.number,
});

/** The screen is 27.6rem wide to apps written for other phones: this root font size makes it so. */
const ROOT_FONT = `${393 / 27.6}px`;

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
    console.warn(`[phone] ${name} is not available on this phone`);
    return Promise.reject(new Error(`${name} is not available on this phone`));
  };

  const onLoad = () => {
    const w = frame.current?.contentWindow as (Window & Record<string, unknown>) | null | undefined;
    if (!w) return;
    frames.set(id, w);
    watchers.current = [];
    const pickPhoto = (o: GalleryOpts) => setGallery(o);
    const pickGif = (run: (gif: string) => void) => setPicker({ kind: 'gif', run });
    const pickEmoji = (run: (emoji: string) => void) => setPicker({ kind: 'emoji', run });
    const pickColor = (o: { onSelect?: (color: string) => void; onClose?: (color: string) => void }) => setPicker({ kind: 'color', run: (c) => (o.onSelect?.(c), o.onClose?.(c)) });
    const onMessage = (event: string, cb: (data: unknown) => void) => w.addEventListener('message', (e: MessageEvent) => e.data?.action === event && cb(e.data.data));
    const components = {
      setPopUp: showPopUp,
      setContextMenu: showContextMenu,
      // ponytail: reuses the action sheet, so only the first ten contacts are offered. Swap for a searchable sheet when lists get long.
      setContactSelector: (o: { onSelect: (c: Contact) => void }) =>
        actions({
          title: t('contacts'),
          options: S.contacts.slice(0, 10).map((c) => ({ label: c.name, run: () => o.onSelect({ firstname: c.name.split(' ')[0], lastname: c.name.split(' ').slice(1).join(' '), number: c.number, name: c.name }) })),
        }),
      setShareComponent: (o: { type?: string; data?: { title?: string; src?: string } }) => share({ kind: o.type === 'image' ? t('kind_photo') : (o.type ?? app.name), label: o.data?.title ?? app.name }),
      setGallery: pickPhoto,
      setFullscreenImage: (src: string | null) => setFull(src),
      setHomeIndicatorVisible: (visible: boolean) => update((x) => (x.hideHomeBar = !visible)),
      saveToGallery: (url?: string) => Promise.resolve(addPhoto(inGame && typeof url === 'string' ? { seed: url } : {}).id),
      // Resolves to the hosted URL. Rejects when the server has no media host set up.
      uploadMedia: async (type: string, blob: Blob) => {
        if (!inGame) return URL.createObjectURL(blob);
        const url = await upload(blob, type === 'Video' ? 'video.webm' : type === 'Audio' ? 'audio.webm' : 'image.jpg');
        if (!url) throw new Error('uploads are not set up on this server');
        return url;
      },
      /** The game's picture in the app's own canvas. The app switches the camera on itself (EnableWalkableCam). */
      createGameRender: (canvas: HTMLCanvasElement) => {
        const view = gameView(canvas);
        let aspect = canvas.width / canvas.height;
        const render = {
          canvas,
          destroyed: !view,
          paused: false,
          recording: false,
          pause: () => (view?.pause(), void (render.paused = true)),
          resume: () => (view?.resume(), void (render.paused = false)),
          // The canvas always holds the whole game frame; a narrower shape is shown, and photographed, centre-cropped.
          resizeByAspect: (ratio: number) => ((aspect = ratio), void (canvas.style.objectFit = 'cover')),
          resize: (width: number, height: number) => render.resizeByAspect(width / height),
          setQuality: () => {},
          setXOffset: () => {},
          setYOffset: () => {},
          render: () => {},
          destroy: () => (view?.destroy(), void (render.destroyed = true)),
          takePhoto: () => (view ? view.photo(aspect).then((blob) => blob ?? Promise.reject(new Error('no picture'))) : Promise.reject(new Error('no game view'))),
          startRecording: (cb: (blob: Blob) => void) => {
            if (!view) return undefined;
            const recorder = new MediaRecorder(view.stream(), { mimeType: 'video/webm' });
            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = () => ((render.recording = false), cb(new Blob(chunks, { type: 'video/webm' })));
            recorder.start();
            render.recording = true;
            return recorder;
          },
        };
        return render;
      },
      setColorPicker: pickColor,
      // Both take options to open, or `false` to close.
      setEmojiPickerVisible: (o: false | { onSelect: (e: { emoji: string }) => void }) => (o ? pickEmoji((emoji) => o.onSelect({ emoji })) : setPicker(null)),
      setGifPickerVisible: (o: false | { onSelect: (gif: string) => void }) => (o ? pickGif(o.onSelect) : setPicker(null)),
      // These belong to the other phone's own insides, or to pickers this phone does not have.
      fetchPhone: unavailable('fetchPhone'),
      setMusicSelector: unavailable('setMusicSelector'),
    };
    const api = {
      resourceName: resource,
      appName: app.name,
      appIdentifier: id,
      settings: settingsFor(),
      getSettings: () => Promise.resolve(settingsFor()),
      // The third argument is another resource to post to; apps written for other phones pass mock data there, which is ignored.
      fetchNui: (event: string, data?: unknown, scriptName?: unknown) => nuiFetch(typeof scriptName === 'string' ? scriptName : resource, event, data),
      onNuiEvent: onMessage,
      useNuiEvent: onMessage,
      onSettingsChange: (cb: (settings: ReturnType<typeof settingsFor>) => void) => void watchers.current.push(cb),
      sendNotification: (n: { title?: string; content?: string }) => notify({ app: id, title: n.title ?? app.name, body: n.content ?? '' }),
      createCall: (c: { number?: string | number; videoCall?: boolean; company?: string }) => (c.number != null || c.company) && startCall(String(c.number ?? c.company), !!c.videoCall, c.company),
      formatPhoneNumber: (n: string | number) => String(n),
      setApp: openByName,
      useCamera: unavailable('useCamera'),
      components,
      // Older apps call these directly instead of through `components`.
      setPopUp: showPopUp,
      setContextMenu: showContextMenu,
      setContactSelector: components.setContactSelector,
      selectGallery: (o: Omit<GalleryOpts, 'onSelect'> & { cb: GalleryOpts['onSelect'] }) => pickPhoto({ ...o, onSelect: o.cb }),
      selectGIF: pickGif,
      selectEmoji: pickEmoji,
      colorPicker: (cb: (color: string) => void) => pickColor({ onSelect: cb }),
    };
    try {
      Object.assign(w, api);
      w.document.documentElement.dataset.theme = theme;
      w.document.documentElement.style.fontSize = ROOT_FONT;
      // Pages that also load as their resource's own overlay hide themselves until they are inside a phone.
      w.document.body.style.visibility = 'visible';
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
