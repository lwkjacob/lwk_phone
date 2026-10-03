import type { ReactNode } from 'react';
import { Bell, Bluetooth, Check, Image as ImageIcon, Moon, Phone, Plane, Radio, ScanFace, Settings as Gear, Signal, Sun, Volume2, Wifi } from 'lucide-react';
import { sfx } from '../sound';
import { S, actions, alert, confirm, prompt, update, useS } from '../store';
import { theme } from '../theme';
import { Avatar, Group, Page, Row, Stack, Toggle, useNav } from '../ui';
import { APPS, AppIcon } from './index';

type Settings = typeof S.settings;
type Flag = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];
const set = <K extends keyof Settings>(k: K, v: Settings[K]) => update((s) => (s.settings[k] = v));

const RINGTONES = ['Reflection', 'Opening', 'Radar', 'Marimba', 'Night Owl'];
const TEXTTONES = ['Tri-tone', 'Note', 'Chord', 'Bamboo'];

function Flip({ k, title, icon, bg, sub }: { k: Flag; title: string; icon?: ReactNode; bg?: string; sub?: string }) {
  const s = useS();
  return <Row icon={icon} iconBg={bg} title={title} sub={sub} right={<Toggle label={title} on={s.settings[k]} onChange={(v) => set(k, v)} />} />;
}

function Picker({ title, k, options }: { title: string; k: 'ringtone' | 'texttone'; options: string[] }) {
  const s = useS();
  return (
    <Page title={title}>
      <Group>
        {options.map((o) => (
          <Row key={o} title={o} onClick={() => (set(k, o), sfx(k === 'ringtone' ? 'ring' : 'notify'))} right={s.settings[k] === o ? <Check size={20} className="tint" strokeWidth={3} /> : undefined} />
        ))}
      </Group>
    </Page>
  );
}

function Notifications() {
  const s = useS();
  const ids = [...s.dock, ...s.apps];
  return (
    <Page title="Notifications">
      <Group header="Notification Style" footer="Apps that are switched off will not show banners or appear on the Lock Screen.">
        {ids.map((id) => (
          <Row key={id} icon={<AppIcon id={id} size={30} />} title={APPS[id].name} right={<Toggle label={APPS[id].name} on={!s.settings.muted[id]} onChange={(v) => update((x) => (x.settings.muted[id] = !v))} />} />
        ))}
      </Group>
    </Page>
  );
}

function Sounds() {
  const s = useS();
  const nav = useNav();
  return (
    <Page title="Sounds & Haptics">
      <Group>
        <Flip k="silent" title="Silent Mode" />
      </Group>
      <Group header="Ringtone and Alerts">
        <div className="row slider-row">
          <Volume2 size={18} />
          <input className="range" type="range" aria-label="Volume" min={0} max={1} step={0.05} value={s.settings.volume} onChange={(e) => set('volume', Number(e.target.value))} onPointerUp={() => sfx('notify')} />
        </div>
      </Group>
      <Group>
        <Row title="Ringtone" value={s.settings.ringtone} chevron onClick={() => nav.push(<Picker title="Ringtone" k="ringtone" options={RINGTONES} />)} />
        <Row title="Text Tone" value={s.settings.texttone} chevron onClick={() => nav.push(<Picker title="Text Tone" k="texttone" options={TEXTTONES} />)} />
      </Group>
    </Page>
  );
}

function Display() {
  const s = useS();
  return (
    <Page title="Display & Brightness">
      <Group header="Appearance">
        <div className="appearance">
          {([false, true] as const).map((dark) => (
            <button key={String(dark)} aria-pressed={s.settings.dark === dark} onClick={() => set('dark', dark)}>
              <span className={`mini-phone ${dark ? 'dark' : ''}`}>9:41</span>
              {dark ? 'Dark' : 'Light'}
              <i>{s.settings.dark === dark && <Check size={14} strokeWidth={4} />}</i>
            </button>
          ))}
        </div>
      </Group>
      <Group header="Brightness">
        <div className="row slider-row">
          <Sun size={16} />
          <input className="range" type="range" aria-label="Brightness" min={0.15} max={1} step={0.05} value={s.settings.brightness} onChange={(e) => set('brightness', Number(e.target.value))} />
          <Sun size={22} />
        </div>
      </Group>
      <Group header="Phone Size" footer="How large the phone is drawn on your screen.">
        <div className="row slider-row">
          <small>A</small>
          <input className="range" type="range" aria-label="Phone size" min={0.8} max={1.2} step={0.05} value={s.settings.size} onChange={(e) => set('size', Number(e.target.value))} />
          <b>A</b>
        </div>
      </Group>
      <Group header="Frame Colour">
        <div className="swatches">
          {Object.entries(theme.frames).map(([id, color]) => (
            <button key={id} aria-label={id} aria-pressed={s.settings.frame === id} style={{ background: color }} onClick={() => set('frame', id)} />
          ))}
        </div>
      </Group>
    </Page>
  );
}

function Wallpaper() {
  const s = useS();
  const choose = (w: string) =>
    actions({
      options: [
        { label: 'Set Lock Screen', run: () => set('lockWallpaper', w) },
        { label: 'Set Home Screen', run: () => set('wallpaper', w) },
        { label: 'Set Both', run: () => (set('lockWallpaper', w), set('wallpaper', w)) },
      ],
    });
  return (
    <Page title="Wallpaper">
      <div className="wall-now">
        <figure>
          <span className="wall-prev" data-wall={s.settings.lockWallpaper} />
          <figcaption>Lock Screen</figcaption>
        </figure>
        <figure>
          <span className="wall-prev" data-wall={s.settings.wallpaper} />
          <figcaption>Home Screen</figcaption>
        </figure>
      </div>
      <Group header="Choose a New Wallpaper">
        <div className="wall-grid">
          {Object.keys(theme.wallpapers).map((w) => (
            <button key={w} className="wall-prev" data-wall={w} aria-label={`${w} wallpaper`} onClick={() => choose(w)} />
          ))}
        </div>
      </Group>
    </Page>
  );
}

function Passcode() {
  const s = useS();
  const has = !!s.settings.passcode;
  const ask = () =>
    prompt('Set Passcode', '4 digits', (v) => (/^\d{4}$/.test(v) ? set('passcode', v) : alert({ title: 'Passcode Not Set', message: 'A passcode must be exactly 4 digits.', buttons: [{ label: 'OK', kind: 'bold' }] })), '', 'Enter a 4-digit passcode.');
  return (
    <Page title="Face ID & Passcode">
      <Group footer="With Face ID on, the phone unlocks as soon as you swipe up. Turn it off to be asked for your passcode.">
        <Flip k="faceId" title="Face ID Unlock" />
      </Group>
      <Group footer={has ? 'A passcode is set.' : 'No passcode. Anyone holding this phone can open it.'}>
        {has ? (
          <>
            <Row tone="tint" title="Change Passcode" onClick={ask} />
            <Row tone="danger" title="Turn Passcode Off" onClick={() => set('passcode', '')} />
          </>
        ) : (
          <Row tone="tint" title="Turn Passcode On" onClick={ask} />
        )}
      </Group>
    </Page>
  );
}

function PhoneSettings() {
  const s = useS();
  const blocked = s.contacts.filter((c) => c.blocked);
  return (
    <Page title="Phone">
      <Group>
        <Row title="My Number" value={s.me.number} />
      </Group>
      <Group footer="Your number is hidden from the people you call.">
        <Flip k="hideCallerId" title="Hide Caller ID" />
      </Group>
      <Group header="Blocked Contacts" footer="Blocked contacts cannot call or message you.">
        {blocked.map((c) => (
          <Row
            key={c.id}
            title={c.name}
            sub={c.number}
            right={
              <button className="tint" onClick={() => update(() => (c.blocked = false))}>
                Unblock
              </button>
            }
          />
        ))}
        {!blocked.length && <Row title={<span className="muted">No blocked contacts</span>} />}
      </Group>
    </Page>
  );
}

function General() {
  const s = useS();
  const nav = useNav();
  return (
    <Page title="General">
      <Group>
        <Row
          title="About"
          chevron
          onClick={() =>
            nav.push(
              <Page title="About">
                <Group>
                  <Row title="Name" value={`${S.me.name.split(' ')[0]}’s Phone`} />
                  <Row title="Software Version" value="1.0" />
                  <Row title="Model" value="Phone Pro" />
                  <Row title="Phone Number" value={S.me.number} />
                </Group>
                <Group>
                  <Row title="Apps" value={S.apps.length + S.dock.length} />
                  <Row title="Photos" value={S.photos.length} />
                  <Row title="Capacity" value="256 GB" />
                </Group>
              </Page>,
            )
          }
        />
      </Group>
      <Group header="Date & Time">
        <Row title="24-Hour Time" right={<Toggle label="24-Hour Time" on={s.settings.clock24} onChange={(v) => set('clock24', v)} />} />
      </Group>
      <Group>
        <Row tone="danger" title="Erase All Content and Settings" onClick={() => confirm('Erase Phone', 'All data on this phone will be reset.', 'Erase', () => window.location.reload())} />
      </Group>
    </Page>
  );
}

function Root() {
  const s = useS();
  const nav = useNav();
  const st = s.settings;
  return (
    <Page title="Settings" large>
      <Group>
        <Row
          className="tall"
          icon={<Avatar name={s.me.name} size={58} />}
          title={<b className="big">{s.me.name}</b>}
          sub={`${s.me.number} · ${s.me.email}`}
          chevron
          onClick={() => prompt('Your Name', 'Name', (v) => update((x) => (x.me.name = v)), s.me.name)}
        />
      </Group>
      <Group>
        <Flip k="airplane" title="Airplane Mode" icon={<Plane size={18} fill="currentColor" strokeWidth={0} />} bg="var(--orange)" />
        <Flip k="wifi" title="Wi-Fi" icon={<Wifi size={18} strokeWidth={2.6} />} bg="var(--blue)" />
        <Flip k="bluetooth" title="Bluetooth" icon={<Bluetooth size={18} strokeWidth={2.6} />} bg="var(--blue)" />
        <Flip k="cellular" title="Mobile Data" icon={<Signal size={18} strokeWidth={3} />} bg="var(--green)" />
      </Group>
      <Group>
        <Row icon={<Bell size={18} fill="currentColor" />} iconBg="var(--red)" title="Notifications" chevron onClick={() => nav.push(<Notifications />)} />
        <Row icon={<Volume2 size={18} fill="currentColor" />} iconBg="var(--pink)" title="Sounds & Haptics" chevron onClick={() => nav.push(<Sounds />)} />
        <Flip k="dnd" title="Do Not Disturb" icon={<Moon size={17} fill="currentColor" strokeWidth={0} />} bg="var(--indigo)" />
        <Flip k="streamer" title="Streamer Mode" icon={<Radio size={18} />} bg="var(--purple)" sub={st.streamer ? 'Photos and media are blurred' : undefined} />
      </Group>
      <Group>
        <Row icon={<Gear size={18} />} iconBg="var(--gray)" title="General" chevron onClick={() => nav.push(<General />)} />
        <Row icon={<Sun size={18} fill="currentColor" />} iconBg="var(--blue)" title="Display & Brightness" chevron onClick={() => nav.push(<Display />)} />
        <Row icon={<ImageIcon size={18} />} iconBg="var(--teal)" title="Wallpaper" chevron onClick={() => nav.push(<Wallpaper />)} />
        <Row icon={<ScanFace size={18} />} iconBg="var(--green)" title="Face ID & Passcode" chevron onClick={() => nav.push(<Passcode />)} />
        <Row icon={<Phone size={17} fill="currentColor" strokeWidth={0} />} iconBg="var(--green)" title="Phone" chevron onClick={() => nav.push(<PhoneSettings />)} />
      </Group>
    </Page>
  );
}

export function SettingsApp() {
  return (
    <Stack>
      <Root />
    </Stack>
  );
}
