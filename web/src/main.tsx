import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter/opsz.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/ui.css';
import './styles/apps.css';
import './styles/social.css';
import { applySkin } from './apps';
import { DevPanel, Gallery } from './DevPanel';
import { inGame } from './net';
import { listen } from './nui';
import { Phone } from './shell/Phone';
import * as store from './store';
import { fetchTheme } from './theme';

const dev = !inGame;
if (dev) {
  document.body.classList.add('dev-env');
  // Poke the phone from the browser console: phone.openApp('maps'), phone.S.settings.dark = true; phone.update()
  Object.assign(window, { phone: store });
}

// theme.json sits beside index.html so a server can restyle the phone without rebuilding it.
fetchTheme('./theme.json').then((file) => {
  applySkin(file);
  // Only now tell the game the UI is ready: a phone that loads earlier would have its saved look overwritten by the theme.
  listen();
  const gallery = dev && window.location.search.includes('gallery=');
  createRoot(document.getElementById('root')!).render(
    gallery ? (
      <Gallery />
    ) : (
      <>
        {dev && <DevPanel />}
        <Phone />
      </>
    ),
  );
});
