# LWK Phone

A free phone for FiveM. A small finished core, add-on apps from an App Store, a theme file servers can edit, and community apps other resources register at runtime. Works on Qbox, QBCore, ESX and standalone servers.

**Status: feature-complete, in testing.** Report anything that breaks on the [issue tracker](https://github.com/lwkjacob/lwk_phone/issues). What is deliberately not built is listed under [Not built](#not-built).

## Install

Needs [ox_lib](https://github.com/overextended/ox_lib), [oxmysql](https://github.com/overextended/oxmysql) and MariaDB 10.2+ or MySQL 8. Voice calls use [pma-voice](https://github.com/AvarianKnight/pma-voice).

1. Put the folder in `resources` and name it `lwk_phone`.
2. In `server.cfg`, after ox_lib, oxmysql, your framework, your inventory and pma-voice:
   ```
   ensure lwk_phone
   ```
3. Start the server. The database tables are created on first start; there is no SQL file to import.

The built UI ships in `web/dist`, so Node is not needed to run the phone.

`F1` opens the phone (players rebind it under Settings > Key Bindings > FiveM), as does `/phone`. `Left Alt` hands the mouse back to the game while the phone stays up, and again to take it back.

In the camera, `Left Alt` lets the mouse aim (in selfie mode it moves the phone around your face), `Enter` is the shutter and `Up` flips the camera. The viewfinder lists these keys.

### The phone as an item

On a framework server with ox_inventory or qb-inventory, the phone is an item and **each item is its own phone**: the number is written onto the item and every bit of phone data is keyed by that number. Give the item away, or have it taken, and the phone goes with it. On standalone servers there is no item and each player simply has a phone.

ox_inventory, in `data/items.lua`:

```lua
['phone'] = { label = 'Phone', weight = 190, stack = false, consume = 0, client = { export = 'lwk_phone.usePhone' } },
```

qb-inventory, in `qb-core/shared/items.lua`: an item named `phone` with `unique = true`, `useable = true`, `shouldClose = true`.

To change this, see `Config.item` (`require = false` drops the item altogether; `unique = false` keeps the item but ties the phone to the character).

### Photos, video and voice messages

These are uploaded to [Fivemanage](https://fivemanage.com). Put your API token in `config/keys.lua` (only the server reads that file), or set it in `server.cfg`:

```
set lwk_phone_fivemanage "your-token"
```

Without a token the camera says storage is not set up, and everything else still works.

## Configure

Everything is in `config/config.lua`, with a comment on each option. The ones most servers touch:

| Option | What it does |
|---|---|
| `locale` | Language file from `config/locales/`. |
| `framework` | `auto` detects Qbox, QBCore or ESX and falls back to standalone. |
| `autoInstallApps` | Whether community apps may install themselves on every phone, or always go to the App Store first (the default). |
| `bank` | Which bank script holds company money. `auto` finds it. |
| `keybind`, `command`, `walk`, `cursorKey` | How the phone opens and whether players can move with it out. |
| `item` | The phone item: which inventory, whether it is required, whether each item is its own phone. |
| `numbers` | Prefixes and length of phone numbers. |
| `calls` | Ring time and voice script. |
| `rtc` | STUN/TURN servers for video calls and live streams. Add a TURN server if video fails for players behind strict routers. |
| `map` | Leave it alone: the map of San Andreas ships with the phone, as a road map and a satellite view. On a server with its own map, `image` is a URL to one picture that replaces it and `bounds` are the game coordinates of that picture's edges. |
| `places` | Places listed in Maps. |
| `companies` | Jobs that players can call or message from Services. |
| `garage` | Valet and impound fees. |
| `music` | Songs for the Music app (direct links to audio files). The app is hidden while the list is empty. |
| `crypto` | Made-up coins bought with bank money. |
| `mailDomain` | The part after `@` in Mail addresses. |

Framework and inventory differences live in `config/bridge/`, one file each for framework, inventory, voice, housing and the client. `housing.lua` is a stub: fill it in for your housing script and the Home app appears.

Apps that a server cannot back are hidden rather than shown empty: Wallet, Crypto, Garage and Services on standalone, Home without a housing bridge, Music without songs.

### Banks

Wallet works with any bank script, because a player's balance is framework bank money in all of them.

The Company Account under Services > My Job (balance, deposit and withdraw, for bosses) is read from whichever of these is running: lwk_bank, Renewed-Banking, qb-banking, okokBanking, qb-management, or esx_addonaccount (`society_<job>`). With none of them, that section is not shown. Phone payments are also written to the bank's own history on Renewed-Banking and qb-banking; lwk_bank lists them by itself. For another bank, edit `config/bridge/banking.lua`.

### Garages

Every garage script keeps vehicles in the framework's table (`player_vehicles` or `owned_vehicles`); they differ in which columns say where a vehicle is. The Garage app reads whichever of these the table has, so there is nothing to configure:

| Columns | Garage scripts |
|---|---|
| `in_garage`, `garage_id`, `impound` | jg-advancedgarages, cd_garage |
| `state`, `garage` | qb-garages, qbx_garages |
| `stored`, `parking`, `pound` | esx_garage and most ESX garages |
| `parking` beside the framework's own | okokGarage |

A vehicle held in a police impound (jg-advancedgarages' `impound_retrievable`) cannot be released from the phone. Set `garage.fromImpound = false` to stop the phone releasing impounded vehicles at all. A garage script with other columns needs `where` and `Bridge.vehicleOut` in `config/bridge/framework.lua` adjusted.

After the valet spawns a vehicle, keys are handed over through qb-vehiclekeys' event (which qbx_vehiclekeys and most key scripts also answer), cd_garage's and okokGarage's. Another key script goes in `Bridge.giveKeys` in `config/bridge/client.lua`.

### Accounts

Flock, Lumen, Loop, Shade and Mail use accounts with a username and password, so a player can hold several, stay anonymous, and sign in from any phone. Admins (ace `lwk_phone.admin`, or the server console) have two commands:

```
phoneverify <app> <username> <1|0>          give or take a verified badge
phonepassword <app> <username> <password>   reset a password
```

A Discord webhook in `config/keys.lua` (or `set lwk_phone_webhook`) logs posts and transfers.

## What ships

A new phone starts with fifteen apps: Phone, Messages, Camera, Photos, Settings, App Store, Wallet, Maps, Garage, Services, Clock, Notes, Voice Memos, Flock and Loop.

The rest are in the App Store: Weather, Calculator, Mail, Music, Home, Lumen, Ember, Shade, Adverts, Market, Crypto. Change which apps start installed with `defaults.apps` and `defaults.dock` in the theme file. A phone that has already rearranged its home screen keeps its own list.

## Exports

Names follow LB Phone's where the meaning is the same, so scripts written for that phone need little changing.

Server:

```lua
exports.lwk_phone:GetEquippedPhoneNumber(source)                 -- number or nil
exports.lwk_phone:GetSourceFromNumber(number)                    -- source or nil
exports.lwk_phone:HasPhoneItem(source)
exports.lwk_phone:IsInCall(source)
exports.lwk_phone:SendNotification(sourceOrNumber, { app = 'settings', title = '', content = '' })
exports.lwk_phone:SendMessage(from, to, text)                    -- `from` can be a name such as 'Bank'
exports.lwk_phone:SendMail({ to = 'name@lsmail.net', sender = 'City Hall', subject = '', message = '' })
exports.lwk_phone:AddTransaction(number, amount, label)          -- a line in Wallet history; move the money yourself
exports.lwk_phone:CreateCall(source, { number = '555-0142', video = false, hidden = false })
```

Client:

```lua
exports.lwk_phone:IsOpen()
exports.lwk_phone:ToggleOpen(open)                               -- true, false, or nil to toggle
exports.lwk_phone:SendNotification({ app = 'settings', title = '', content = '' })
exports.lwk_phone:AddCustomApp(app)                              -- see Community apps
exports.lwk_phone:RemoveCustomApp(identifier)
exports.lwk_phone:SendCustomAppMessage(identifier, data)
```

## Theme file

`web/dist/theme.json` sits beside `index.html`, so it can be edited on a live server without rebuilding (in the source tree it is `web/public/theme.json`). Anything in it is laid over the built-in skin (`web/src/theme.default.json`); leave a key out to keep the default.

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

`themes/slate.json` is a second skin made with nothing but this file. Copy it over `theme.json` to use it.

## Languages

The phone ships in English (`en`, the default) and French (`fr`). Set `Config.locale` to the one you want.

### Translating

All text lives in `config/locales/en.json`: `"ui"` for the interface, `"server"` for messages that come from Lua.

1. Copy `en.json` to `<code>.json` (`de.json`, `es.json`, ...).
2. Translate the values only. Leave the keys alone, and keep every `{placeholder}` and `%s` exactly as written; where a line has several `%s`, they must stay in the same order.
3. Set `"meta.name"` to the language's own name and `"meta.intl"` to its locale code (`de-DE`), which decides how dates and numbers are written.
4. Set `Config.locale = '<code>'` and restart the phone.

Anything left out falls back to English, so a half-finished file still works. Translations are welcome as pull requests.

## Community apps

These work the way LB Phone's custom apps do, with the same names and shapes, so an app written for one ports to the other with little change.

A resource registers an app and points at its own HTML page. The phone loads that page in an iframe and adds a set of globals to it.

```lua
exports.lwk_phone:AddCustomApp({
    identifier = 'pizza',                 -- unique, not shown
    name = 'Pizza This',
    description = 'Order a pizza to wherever you are standing.',
    developer = 'Example',                -- optional
    ui = GetCurrentResourceName() .. '/ui/index.html', -- leave out for an app that only runs a function
    icon = 'https://cfx-nui-' .. GetCurrentResourceName() .. '/ui/icon.png',
    defaultApp = false,                   -- true installs it for everyone, if the server allows it (see below)
    landscape = false,                    -- open sideways, for games and video
    price = 0,                            -- bank money charged on install (free on servers without money)
    size = 412,                           -- kB, shown in the App Store
    images = {},                          -- App Store screenshots
    keepOpen = false,                     -- apps without a ui close the phone when tapped unless this is set
    onOpen = function() end,              -- also onClose, onUse, onInstall, onDelete
})
exports.lwk_phone:RemoveCustomApp('pizza')
exports.lwk_phone:SendCustomAppMessage('pizza', { action = 'orderReady', data = { minutes = 4 } })
```

An app is removed automatically when the resource that registered it stops.

Community apps appear in the App Store and players install the ones they want. `defaultApp = true` only puts an app straight on every home screen when the server sets `autoInstallApps = true` in `config/config.lua`.

### Apps written for LB Phone

These run unchanged, once the server has a resource called `lb-phone` for them to find. Every export of this phone already answers under that name; what is missing is only the name itself, which those apps list as a dependency and wait for. Create a folder named `lb-phone` next to `lwk_phone` containing one file, `fxmanifest.lua`:

```lua
fx_version 'cerulean'
game 'gta5'
description 'Lets apps written for LB Phone find lwk_phone'
dependency 'lwk_phone'
```

Start it after the phone and before the apps (`ensure lb-phone`, or put it in the same `[folder]`). Do not do this on a server that runs the real lb-phone. Some apps support several phones and have a setting for which one to use: set it to LB Phone.

Inside the app's page the same globals exist (`fetchNui`, `useNuiEvent`, `getSettings`, `components.*` and the older top-level `setPopUp`, `selectGallery` and friends), the page is sized the same way (the screen is 27.6rem wide), and the `'componentsLoaded'` message is sent once they are ready.

Beyond the custom-app exports, these also answer under that name. Client: `SendNotification`, `IsOpen`, `ToggleOpen`, `GetEquippedPhoneNumber`, `HasPhoneItem`, `IsDisabled`, `ToggleDisabled`, `OpenApp`, `CloseApp`, `CreateCall`, `IsInCall`, `AddContact`, `SaveToGallery`, `SetPopUp`, `SetContextMenu`, `ToggleHomeIndicator`, `ToggleLandscape`, `ToggleFlashlight`, `EnableWalkableCam`, `DisableWalkableCam`, `GetSettings`, `GetAirplaneMode`, `GetStreamerMode`, `FormatNumber`, and the callback trio. Server: `GetEquippedPhoneNumber`, `GetSourceFromNumber`, `HasPhoneItem`, `SendNotification`, `NotifyEveryone`, `SendMessage`, `SendCoords`, `SendMail`, `AddTransaction`, `AddContact`, `CreateCall`, `EndCall`, `IsInCall`, `GetSettings`, `HasAirplaneMode`, `GetSocialMediaUsername`, `FormatNumber`, `RegisterCallback`, `BaseCallback`.

Exports with no counterpart here (battery, custom numbers, music and live trays, posting to its social apps, and so on) answer `nil` and print one line in the console naming the export, so an app that calls one keeps running. In a page, `useCamera`, `components.fetchPhone`, `components.setMusicSelector` and `GameMap` are not available.

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
| `components.uploadMedia(type, blob)` | Upload `"Image"`, `"Video"` or `"Audio"`; resolves with its URL. |
| `components.createGameRender(canvas)` | Draws the game's picture into your canvas; `takePhoto()`, `startRecording(cb)`, `pause()`, `resume()`, `destroy()`. |
| `components.setEmojiPickerVisible({ onSelect })` | Emoji picker; `onSelect({ emoji })`. Pass `false` to close. |
| `components.setGifPickerVisible({ onSelect })` | GIF picker; `onSelect(url)`. Pass `false` to close. |
| `components.setColorPicker({ onSelect, onClose })` | Colour picker; both receive a hex colour. |

The phone also sets `data-theme` on the page's `<html>` and three CSS variables, `--safe-top`, `--safe-bottom` and `--safe-left`, for the space the status bar, home indicator and (sideways) camera cut-out cover.

`web/public/example-app/` is a complete example in one HTML file with no build step.

## Not built

- **Ringtones and sound effects.** The sound engine is in `web/src/sound.ts`, switched off.
- **Voicemail.** The tab only exists in the browser demo.
- **GIF search.** There is no GIF service behind the picker in-game, so Messages leaves the option out.
- **Mute and speaker on calls.** The buttons are there; voice is whatever the voice script does.
- **Switching a call between voice and video** once it has started.
- **Who liked your post** in Flock's activity tab (replies are listed, likes are only counted).
- **Distance in Ember.** Everyone on the server is in the deck.
- **Promoting employees** from Services. Hiring, firing and the company account are there.
- **Housing.** `config/bridge/housing.lua` is a stub; the Home app stays hidden until it is filled in.
- **Recorded clips are the whole game view**, not cropped to the viewfinder.
- `GameMap`, `useCamera` and the music selector for community apps.

## Develop

```bash
npm --prefix web install
npm --prefix web run dev        # the phone in a browser, on mock data, at localhost:5174
npm --prefix web run build      # output in web/dist, targets FiveM's older Chromium
```

In a browser the phone runs on mock data and never contacts a server; the dev panel on the left fakes what the game would send. In the console, `phone` exposes the store (`phone.openApp('maps')`).

Dev panel extras: **Network: fast / slow / fail** shows each app's loading placeholder and its "couldn't load" screen. **Pseudo-language** brackets and accents every translated string, so any plain text is hard-coded. **WebRTC loopback test** connects two peers inside the page.

Review sheet: `http://localhost:5174/?gallery=notes,mail,crypto` shows several apps side by side. Add `&theme=light`, `&tab=1`, `&push=1` or `&pseudo=1`.

### How the pieces talk

A phone is its number, and every table is keyed by number.

- UI to server: `rpc(name, data)` in `web/src/net.ts` → the NUI callback `rpc` in `client/main.lua` → `RPC[name](source, number, data)` in `server/*.lua`, which answers `{ ok = true, ... }` or `{ ok = false, error }`. Requests that need the game itself (waypoints, the camera) are handled on the client in `Local[name]`.
- Server to UI: `Phone.push(sourceOrNumber, { action = ... })` → `web/src/nui.ts`.
- Private data (contacts, notes, settings, photos) is saved generically: the UI sends any slice that changed, the server stores it as JSON.

```
config/         config.lua, keys.lua (server-only secrets), locales/, bridge/ (framework, inventory, voice, housing)
shared/         util.lua (validation), locale.lua
server/         db.lua (schema), main.lua (phones, requests, storage), messages, calls, social, apps, exports
client/         main.lua (open/close, focus, the pipe to the UI), prop, camera, apps, exports
web/src/
  shell/        lock screen, home screen, Control Center, calls, dialogs
  apps/         one file per app (or small group); index.tsx is the registry
  store.ts      state and actions
  data.ts       mock data for the browser; these shapes are what the server sends
  net.ts        requests to the game        nui.ts   messages from the game
  rtc.ts        WebRTC (video calls, live)  gameview.ts   the game's picture in a canvas
  theme.ts, i18n.ts, pickers.tsx, ui.tsx, sound.ts
```

## Licence

GPL-3.0. See [LICENSE](LICENSE).

The map pictures in `tiles/` are not covered by that licence. They are the Grand Theft Auto V map, which belongs to Rockstar Games, cut into tiles by [VIRUXE/gtav-map-tiles](https://github.com/VIRUXE/gtav-map-tiles). This project is not affiliated with or endorsed by Rockstar Games.
