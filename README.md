# Phone

A phone UI for FiveM: a small finished core, add-on apps from an App Store, a theme file servers can edit, and community apps other resources register at runtime.

**Status: UI complete, game side not started.** Everything runs in a browser against mock data. The game side (calls, voice, camera, storage, framework support for QBCore, Qbox, ESX and standalone) is not written yet. What the UI expects from it is listed under [What the game side must provide](#what-the-game-side-must-provide).

## Run it

```bash
npm --prefix web install
npm --prefix web run dev
```

The dev panel on the left fakes what the game would send. `F1` opens and closes the phone. In the browser console, `phone` exposes the store (`phone.openApp('maps')`).

```bash
npm --prefix web run build      # output in web/dist, targets FiveM's older Chromium
node web/src/calc.check.ts      # calculator arithmetic check
```

Dev panel extras:

- **Network: fast / slow / fail** shows each app's loading placeholder and its "couldn't load" screen.
- **Pseudo-language** brackets and accents every translated string, so any plain text is hard-coded.
- **WebRTC loopback test** connects two peers inside the page and checks audio arrives.
- **Run first-time setup** replays the setup flow.

Review sheet: `http://localhost:5174/?gallery=notes,mail,crypto` shows several apps side by side. Add `&theme=light`, `&tab=1`, `&push=1` or `&pseudo=1`.

## What ships

Ten core apps are installed on a new phone: Phone, Messages, Camera, Photos, Settings, App Store, Wallet, Maps, Garage, Services.

Sixteen add-ons are in the App Store: Clock, Weather, Notes, Calculator, Voice Memos, Mail, Music, Home, Flock, Lumen, Loop, Ember, Shade, Adverts, Market, Crypto. Change which apps start installed with `defaults.apps` and `defaults.dock` in the theme file.

## Theme file

`web/public/theme.json` sits beside `index.html` in the build, so it can be edited on a live server without rebuilding. Anything in it is laid over the built-in skin (`web/src/theme.default.json`); leave a key out to keep the default.

| Key | What it controls |
|---|---|
| `font` | CSS font stack. Must be a system font or the bundled Inter. |
| `iconRadius` | Icon corner radius as a fraction of size. `0.225` is a rounded square, `0.5` a circle. |
| `island` | `"pill"` or `"hole"` (a punch hole that widens only for calls, recording and music). |
| `frames` | Frame colours offered in Settings: `{ "id": "#hex" }`. |
| `wallpapers` | Wallpapers offered in Settings: `{ "id": "<any CSS background-image>" }`. |
| `colors.light` / `colors.dark` | Overrides for the colour tokens in `web/src/styles/base.css`, e.g. `{ "--blue": "#0b8a7a" }`. |
| `apps` | Per-app `name`, `bg`, `fg` and `icon` (an image URL), keyed by app id. |
| `defaults` | `dark`, `wallpaper`, `lockWallpaper`, `frame`, `apps`, `dock` for a fresh phone. |

`web/public/themes/slate.json` is a second skin made with nothing but this file. Copy it over `theme.json` to use it, or press **Skin** in the dev panel.

## Languages

All interface text lives in `config/locales/en.json` under `"ui"`, the same layout `lwk_bank` uses. Copy it to `<code>.json`, translate the values, and keep the `{placeholders}`. `"meta.intl"` sets the locale for dates and numbers. Anything missing falls back to English.

The game picks the language by sending `{ action = "setLocale", ui = <the "ui" table>, intl = "de-DE" }`.

## Community apps

These work the way LB Phone's custom apps do, with the same names and shapes, so an app written for one ports to the other with little change.

A resource registers an app and points at its own HTML page. The phone loads that page in an iframe and adds a set of globals to it.

```lua
-- Planned export, same signature as LB Phone's. The resource name is a placeholder.
exports["lwk_phone"]:AddCustomApp({
    identifier = "pizza",                 -- unique, not shown
    name = "Pizza This",
    description = "Order a pizza to wherever you are standing.",
    developer = "Example",                -- optional
    ui = GetCurrentResourceName() .. "/ui/index.html", -- leave out for an app that only runs a function
    icon = "https://cfx-nui-" .. GetCurrentResourceName() .. "/ui/icon.png",
    defaultApp = false,                   -- true installs it for everyone
    landscape = false,                    -- open sideways, for games and video
    price = 0,                            -- in-game money charged on install
    size = 412,                           -- kB, shown in the App Store
    images = {},                          -- App Store screenshots
    keepOpen = false,                     -- apps without a ui close the phone when tapped unless this is set
})
exports["lwk_phone"]:RemoveCustomApp("pizza")
exports["lwk_phone"]:SendCustomAppMessage("pizza", { action = "orderReady", data = { minutes = 4 } })
```

The Lua exports are not written yet. They are thin: each one sends a NUI message that the UI already handles (`web/src/nui.ts`).

| Export | NUI message |
|---|---|
| `AddCustomApp(app)` | `{ action = "addCustomApp", app = app }` |
| `RemoveCustomApp(id)` | `{ action = "removeCustomApp", identifier = id }` |
| `SendCustomAppMessage(id, data)` | `{ action = "customAppMessage", identifier = id, data = data }` |

The phone reports back by POSTing `customApp` to its own resource with `{ identifier, event }`, where `event` is `open`, `close`, `use`, `install` or `delete`. That is where `onOpen`, `onClose`, `onUse`, `onInstall` and `onDelete` callbacks will hook in.

### Inside the app's page

The globals exist once the page receives the message `'componentsLoaded'`.

```js
window.addEventListener('message', (e) => e.data === 'componentsLoaded' && start());
```

| Global | Use |
|---|---|
| `resourceName`, `appName`, `appIdentifier` | Who registered the app. |
| `settings` | `display.theme` (`"dark"` or `"light"`), `airplaneMode`, `streamerMode`, `doNotDisturb`, `sound`, `time`, `name`, `phoneNumber`. |
| `onSettingsChange(cb)` | Called when any of the above changes. |
| `fetchNui(event, data?, scriptName?)` | POST to your resource's NUI callback. Load initial data this way when the page starts. |
| `onNuiEvent(event, cb)` | Receives `SendCustomAppMessage` pushes shaped `{ action, data }`. |
| `sendNotification({ title, content })` | Phone notification from your app. |
| `createCall({ number, videoCall })` | Start a call. |
| `setApp(name)` | Open another app by name or id. |
| `formatPhoneNumber(n)` | Formats a number for display. |
| `components.setPopUp({ title, description, attachment, input, buttons })` | Alert with buttons (`title`, `color`, `bold`, `cb`). |
| `components.setContextMenu({ title, buttons })` | Action sheet. |
| `components.setContactSelector({ onSelect })` | Pick a contact. |
| `components.setGallery({ includeImages, includeVideos, multiSelect, onSelect })` | Pick from the photo library. |
| `components.setShareComponent({ type, data })` | Open the share sheet. |
| `components.setFullscreenImage(src)` | Show an image full screen. |
| `components.setHomeIndicatorVisible(bool)` | Hide the home indicator, for full-screen apps. |
| `components.saveToGallery(url)` | Save to the photo library; resolves with the new id. |
| `components.setEmojiPickerVisible({ onSelect })` | Emoji picker; `onSelect({ emoji })`. Pass `false` to close. |
| `components.setGifPickerVisible({ onSelect })` | GIF picker; `onSelect(url)`. Pass `false` to close. |
| `components.setColorPicker({ onSelect, onClose })` | Colour picker; both receive a hex colour. |

The phone also sets `data-theme` on the page's `<html>` and three CSS variables, `--safe-top`, `--safe-bottom` and `--safe-left`, for the space the status bar, home indicator and (sideways) camera cut-out cover.

Not available yet (they reject and log a warning): `uploadMedia`, `createGameRender`, `GameMap`. All three need the game.

`web/public/example-app/` is a complete example in one HTML file with no build step. **Add community app** in the dev panel registers it.

## What the game side must provide

The UI is finished against mock data. These are the places it stops and waits for the game.

| Area | What the UI does now | What the game must supply |
|---|---|---|
| App data | Each app with `data` in the registry posts `appData` with `{ app }` when first opened, shows a placeholder while waiting and a retry screen on failure. | Reply with that app's data in the shapes in `web/src/data.ts`. It is merged into the store. |
| Language | Reads `config/locales/en.json`; handles `setLocale`. | Send the active locale's `"ui"` table. |
| Setup | Runs once, remembered in the browser. | Store "set up" per phone and send it with the phone's data. |
| Voice and video | `web/src/rtc.ts` runs the WebRTC handshake (as LB Phone does for video calls, live and nearby voices) and posts signals as `rtc` with `{ to, signal }`. Video-call audio already uses it in-game. | Relay signals to the other player as `{ action = "rtc", from, signal }`, and send `{ action = "rtcConfig", config }` with ICE/TURN servers. Plain voice calls can stay on the voice script. |
| Recordings | Voice memos and voice messages record the microphone and play back locally. | Upload the recording so other players can hear it. |
| Camera | A generated scene stands in for the viewfinder; photos are generated images. | Render the game view to the viewfinder and upload captures. |
| GIFs | The picker searches a built-in placeholder list. | Search a GIF service and return URLs. |
| Community apps | Handles the three exports' messages and reports `customApp` events. | The `AddCustomApp`, `RemoveCustomApp`, `SendCustomAppMessage` exports and the Lua callbacks. |
| Everything else | Calls, texts, payments, vehicles and so on change the mock store directly (`web/src/store.ts`). | Replace each action with a request to the server, and push changes back in. |

## Layout

```
web/src/
  shell/        lock screen, home screen, Control Center, calls, dialogs
  apps/         one file per app (or small group); index.tsx is the registry
  apps/Custom.tsx   the iframe host and injected API for community apps
  ui.tsx        shared building blocks: navigation, lists, sheets, chat
  store.ts      state and actions
  data.ts       mock data; these shapes are the contract the game side must fill
  theme.ts      loads and applies the theme file
  i18n.ts       translations (config/locales)
  pickers.tsx   emoji, GIF and colour pickers
  rtc.ts        WebRTC connections and microphone recording
  nui.ts        the bridge to the game
  sound.ts      sound effects, switched off (ENABLED = false)
```
