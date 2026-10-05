import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// The map tiles sit at the resource root, two folders above the built page, which is where FiveM serves
// them from. They are not copied into dist (that would commit 23 MB twice), so the dev server hands them out.
const tiles: Plugin = {
  name: 'tiles',
  configureServer(server) {
    const root = server.config.root;
    const tilesDir = encodeURI(`/@fs/${root.slice(0, root.lastIndexOf('/'))}`);
    server.middlewares.use((req, _res, next) => {
      const r = req as { url?: string };
      if (r.url?.startsWith('/tiles/')) r.url = tilesDir + r.url;
      next();
    });
  },
};

export default defineConfig({
  plugins: [react(), tiles],
  // FiveM loads the UI from nui://<resource>/web/dist/, so asset paths must be relative.
  base: './',
  // The UI bundles config/locales/en.json from the resource root as its fallback strings.
  server: { fs: { allow: ['..'] } },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // ponytail: FiveM's CEF lags desktop Chrome; bump this once you've confirmed your client's version.
    target: 'chrome95',
    chunkSizeWarningLimit: 900,
  },
});
