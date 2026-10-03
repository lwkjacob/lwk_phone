import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter/opsz.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/ios.css';
import './styles/apps.css';
import './styles/social.css';
import { applySkin } from './apps';
import { DevPanel } from './DevPanel';
import { listen } from './nui';
import { Phone } from './shell/Phone';
import * as store from './store';
import { fetchTheme } from './theme';

// ponytail: the bridge only carries community apps so far (nui.ts). Calls, texts and the rest still come
// from the DevPanel; add their messages to nui.ts when the Lua side exists.
listen();
const dev = !('GetParentResourceName' in window);
if (dev) {
  document.body.classList.add('dev-env');
  // Poke the phone from the browser console: phone.openApp('maps'), phone.S.settings.dark = true; phone.update()
  Object.assign(window, { phone: store });
}

// theme.json sits beside index.html so a server can restyle the phone without rebuilding it.
fetchTheme('./theme.json').then((file) => {
  applySkin(file);
  createRoot(document.getElementById('root')!).render(
    <>
      {dev && <DevPanel />}
      <Phone />
    </>,
  );
});
