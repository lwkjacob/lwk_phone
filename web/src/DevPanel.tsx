import { useEffect } from 'react';
import { APPS, applySkin } from './apps';
import { alert, incomingCall, lock, notify, receiveMsg, uid, update, useS } from './store';
import { pseudoLocale } from './i18n';
import { loopbackTest } from './rtc';
import { fetchTheme, theme } from './theme';

let pseudo = false;

/** Browser-only controls that fake what the game would send: calls, texts, notifications, AirShare. */
export function DevPanel() {
  const s = useS();
  useEffect(() => {
    // F1 toggles the phone, like the usual keybind in-game.
    const onKey = (e: KeyboardEvent) => e.key === 'F1' && (e.preventDefault(), update((x) => (x.open = !x.open)));
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const airshare = () =>
    alert({
      title: 'AirShare',
      message: 'Ava Castillo would like to share a photo.',
      buttons: [
        { label: 'Decline', kind: 'cancel' },
        { label: 'Accept', kind: 'bold', run: () => (update((x) => x.photos.unshift({ id: uid(), seed: 15, time: Date.now() })), notify({ app: 'photos', title: 'AirShare', body: 'Photo from Ava Castillo saved to your library.' })) },
      ],
    });

  return (
    <aside className="dev">
      <h1>Dev controls</h1>
      <p>Simulate what the game sends to the phone.</p>
      <button onClick={() => update((x) => (x.open = !x.open))}>{s.open ? 'Close phone' : 'Open phone'} (F1)</button>
      <button onClick={lock}>Lock</button>
      <button onClick={() => incomingCall('555-0142')}>Incoming call</button>
      <button onClick={() => incomingCall('555-0188', true)}>Incoming video call</button>
      <button onClick={() => incomingCall('555-0173')}>Call from unknown number</button>
      <button onClick={() => receiveMsg('555-0142', { text: 'Where are you? Everyone’s already here.' })}>Incoming text</button>
      <button onClick={() => receiveMsg('555-0188', { pic: 30 })}>Incoming photo</button>
      <button onClick={() => notify({ app: 'flock', title: 'Flock', body: 'Gia Thompson liked your post.' })}>Flock notification</button>
      <button onClick={() => notify({ app: 'wallet', title: 'LWK Bank', body: 'You received $750.00 from Dex Holloway.' })}>Bank notification</button>
      <button onClick={airshare}>AirShare request</button>
      {/* The same messages the AddCustomApp and SendCustomAppMessage exports send from Lua. */}
      <button
        onClick={() =>
          window.postMessage(
            {
              action: APPS.pizza ? 'removeCustomApp' : 'addCustomApp',
              identifier: 'pizza',
              app: { identifier: 'pizza', name: 'Pizza This', description: 'Order a pizza to wherever you are standing. An example community app.', developer: 'Example', ui: './example-app/index.html', icon: './example-app/icon.svg', defaultApp: true, size: 412 },
            },
            '*',
          )
        }
      >
        {APPS.pizza ? 'Remove' : 'Add'} community app
      </button>
      <button disabled={!APPS.pizza} onClick={() => window.postMessage({ action: 'customAppMessage', identifier: 'pizza', data: { action: 'orderReady', data: { minutes: 4 } } }, '*')}>
        Message community app
      </button>
      <button onClick={() => update((x) => Object.keys(APPS).forEach((id) => x.apps.includes(id) || x.dock.includes(id) || x.apps.push(id)))}>Install every add-on</button>
      <button onClick={() => loopbackTest().then((ok) => alert({ title: 'WebRTC loopback', message: ok ? 'Connected: audio travelled between two in-page peers.' : 'Failed: no audio arrived within 6 seconds.', buttons: [{ label: 'OK', kind: 'bold' }] }))}>
        WebRTC loopback test
      </button>
      {/* Pseudo-language: translated strings show [bracketed and accented], so any plain text is hard-coded. */}
      <button onClick={() => window.postMessage({ action: 'setLocale', ui: (pseudo = !pseudo) ? pseudoLocale() : {} }, '*')}>Pseudo-language</button>
      <button onClick={() => fetchTheme(theme.name === 'Slate' ? './theme.json' : './themes/slate.json').then(applySkin)}>Skin: {theme.name}</button>
      <button onClick={() => update((x) => (x.settings.dark = !x.settings.dark))}>{s.settings.dark ? 'Light' : 'Dark'} appearance</button>
      <button onClick={() => update((x) => ((x.net = x.net === 'fast' ? 'slow' : x.net === 'slow' ? 'fail' : 'fast'), (x.loaded = {})))}>Network: {s.net}</button>
      <button onClick={() => update((x) => (x.focus = !x.focus))}>{s.focus ? 'In-game position' : 'Centre and enlarge'}</button>
    </aside>
  );
}

/**
 * Review sheet: several apps side by side, without the shell.
 * ?gallery=notes,mail,crypto  &theme=light  &tab=1 (press the nth tab)  &push=1 (open the first row)  &pseudo=1
 */
export function Gallery() {
  useS();
  const q = new URLSearchParams(window.location.search);
  const ids = (q.get('gallery') ?? '').split(',').filter((id) => APPS[id]);
  const dark = q.get('theme') !== 'light';
  useEffect(() => {
    if (q.get('pseudo')) window.postMessage({ action: 'setLocale', ui: pseudoLocale() }, '*');
    const timer = window.setTimeout(() => {
      document.querySelectorAll('.gallery .app').forEach((app) => {
        const tab = q.get('tab');
        if (tab) app.querySelectorAll<HTMLElement>('.tabbar button')[Number(tab)]?.click();
        if (q.get('push')) window.setTimeout(() => app.querySelector<HTMLElement>('.pg-body button.row, .pg-body .row-btn, .house-list button, .car-list button, .market button, .store-row, .coins .row, .alpha button')?.click(), 150);
      });
    }, 200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on load
  }, []);
  return (
    <div className="gallery">
      {ids.map((id) => {
        const View = APPS[id].view;
        const appDark = APPS[id].dark ?? dark;
        return (
          <div key={id} className="phone-body" style={{ zoom: 0.58 }}>
            <div className="bezel">
              <div className={`screen ${appDark || APPS[id].bar === 'light' ? 'bar-light' : 'bar-dark'}`} data-theme={dark ? 'dark' : 'light'}>
                <div className="app" data-app={id} data-theme={appDark ? 'dark' : 'light'} style={{ animation: 'none' }}>
                  <View />
                  <div id="overlay" />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
