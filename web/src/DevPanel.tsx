import { useEffect } from 'react';
import { APPS, applySkin } from './apps';
import { alert, incomingCall, lock, notify, receiveMsg, uid, update, useS } from './store';
import { fetchTheme, theme } from './theme';

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
      <button onClick={() => fetchTheme(theme.name === 'Slate' ? './theme.json' : './themes/slate.json').then(applySkin)}>Skin: {theme.name}</button>
      <button onClick={() => update((x) => (x.settings.dark = !x.settings.dark))}>{s.settings.dark ? 'Light' : 'Dark'} appearance</button>
      <button onClick={() => update((x) => (x.focus = !x.focus))}>{s.focus ? 'In-game position' : 'Centre and enlarge'}</button>
    </aside>
  );
}
