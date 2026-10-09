import { useState, type ReactNode } from 'react';
import { Bell, Bluetooth, Check, Image as ImageIcon, Moon, Phone, Plane, Radio, ScanFace, Settings as Gear, Signal, Sun, Volume2, Wifi } from 'lucide-react';
import { RINGTONES, TEXTTONES, sfx, toneOf } from '../sound';
import { S, actions, alert, confirm, prompt, update, useS } from '../store';
import { theme } from '../theme';
import { Avatar, Group, Page, Row, Stack, Toggle, useNav } from '../ui';
import { APPS, AppIcon } from './index';
import { t } from '../i18n';
import { ColorSheet } from '../pickers';

type Settings = typeof S.settings;
type Flag = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];
const set = <K extends keyof Settings>(k: K, v: Settings[K]) => update((s) => (s.settings[k] = v));

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
          <Row key={o} title={o} onClick={() => (set(k, o), sfx(k === 'ringtone' ? 'ring' : 'notify'))} right={toneOf(s.settings[k], options) === o ? <Check size={20} className="tint" strokeWidth={3} /> : undefined} />
        ))}
      </Group>
    </Page>
  );
}

function Notifications() {
  const s = useS();
  const ids = [...s.dock, ...s.apps];
  return (
    <Page title={t('notifications')}>
      <Group header={t('settings_notification_style')} footer={t('settings_apps_that_are_switched_off_will')}>
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
    <Page title={t('settings_sounds_haptics')}>
      <Group>
        <Flip k="silent" title={t('silent_mode')} />
      </Group>
      <Group header={t('settings_ringtone_and_alerts')}>
        <div className="row slider-row">
          <Volume2 size={18} />
          <input className="range" type="range" aria-label={t('volume')} min={0} max={1} step={0.05} value={s.settings.volume} onChange={(e) => set('volume', Number(e.target.value))} onPointerUp={() => sfx('notify')} />
        </div>
      </Group>
      <Group>
        <Row title={t('settings_ringtone')} value={toneOf(s.settings.ringtone, RINGTONES)} chevron onClick={() => nav.push(<Picker title={t('settings_ringtone')} k="ringtone" options={RINGTONES} />)} />
        <Row title={t('settings_text_tone')} value={toneOf(s.settings.texttone, TEXTTONES)} chevron onClick={() => nav.push(<Picker title={t('settings_text_tone')} k="texttone" options={TEXTTONES} />)} />
      </Group>
    </Page>
  );
}

function Display() {
  const s = useS();
  const [picking, setPicking] = useState(false);
  return (
    <Page title={t('settings_display_brightness')}>
      <Group header={t('settings_appearance')}>
        <div className="appearance">
          {([false, true] as const).map((dark) => (
            <button key={String(dark)} aria-pressed={s.settings.dark === dark} onClick={() => set('dark', dark)}>
              <span className={`mini-phone ${dark ? 'dark' : ''}`}>9:41</span>
              {dark ? t('settings_dark') : t('settings_light')}
              <i>{s.settings.dark === dark && <Check size={14} strokeWidth={4} />}</i>
            </button>
          ))}
        </div>
      </Group>
      <Group header={t('brightness')}>
        <div className="row slider-row">
          <Sun size={16} />
          <input className="range" type="range" aria-label={t('brightness')} min={0.15} max={1} step={0.05} value={s.settings.brightness} onChange={(e) => set('brightness', Number(e.target.value))} />
          <Sun size={22} />
        </div>
      </Group>
      <Group header={t('settings_phone_size')} footer={t('settings_how_large_the_phone_is_drawn')}>
        <div className="row slider-row">
          <small>A</small>
          <input className="range" type="range" aria-label={t('settings_phone_size_2')} min={0.8} max={1.2} step={0.05} value={s.settings.size} onChange={(e) => set('size', Number(e.target.value))} />
          <b>A</b>
        </div>
      </Group>
      <Group header={t('settings_frame_colour')}>
        <div className="swatches">
          {Object.entries(theme.frames).map(([id, color]) => (
            <button key={id} aria-label={id} aria-pressed={s.settings.frame === id} style={{ background: color }} onClick={() => set('frame', id)} />
          ))}
          <button className="custom" aria-label={t('custom_colour')} aria-pressed={s.settings.frame === 'custom'} onClick={() => setPicking(true)} />
        </div>
      </Group>
      {picking && <ColorSheet value={s.settings.frameColor} onPick={(c) => (set('frameColor', c), set('frame', 'custom'))} onClose={() => setPicking(false)} />}
    </Page>
  );
}

function Wallpaper() {
  const s = useS();
  const choose = (w: string) =>
    actions({
      options: [
        { label: t('settings_set_lock_screen'), run: () => set('lockWallpaper', w) },
        { label: t('settings_set_home_screen'), run: () => set('wallpaper', w) },
        { label: t('settings_set_both'), run: () => (set('lockWallpaper', w), set('wallpaper', w)) },
      ],
    });
  return (
    <Page title={t('settings_wallpaper')}>
      <div className="wall-now">
        <figure>
          <span className="wall-prev" data-wall={s.settings.lockWallpaper} />
          <figcaption>{t('settings_lock_screen')}</figcaption>
        </figure>
        <figure>
          <span className="wall-prev" data-wall={s.settings.wallpaper} />
          <figcaption>{t('settings_home_screen')}</figcaption>
        </figure>
      </div>
      <Group header={t('settings_choose_a_new_wallpaper')}>
        <div className="wall-grid">
          {Object.keys(theme.wallpapers).map((w) => (
            <button key={w} className="wall-prev" data-wall={w} aria-label={t('settings_w_wallpaper', { w })} onClick={() => choose(w)} />
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
    prompt(t('settings_set_passcode'), t('settings_4_digits'), (v) => (/^\d{4}$/.test(v) ? set('passcode', v) : alert({ title: t('settings_passcode_not_set'), message: t('settings_a_passcode_must_be_exactly_4'), buttons: [{ label: t('ok'), kind: 'bold' }] })), '', t('settings_enter_a_4_digit_passcode'));
  return (
    <Page title={t('settings_face_unlock_passcode')}>
      <Group footer={t('settings_with_face_unlock_on')}>
        <Flip k="faceId" title={t('settings_face_unlock')} />
      </Group>
      <Group footer={has ? t('settings_a_passcode_is_set') : t('settings_no_passcode_anyone_holding_this_phone')}>
        {has ? (
          <>
            <Row tone="tint" title={t('settings_change_passcode')} onClick={ask} />
            <Row tone="danger" title={t('settings_turn_passcode_off')} onClick={() => set('passcode', '')} />
          </>
        ) : (
          <Row tone="tint" title={t('settings_turn_passcode_on')} onClick={ask} />
        )}
      </Group>
    </Page>
  );
}

function PhoneSettings() {
  const s = useS();
  const blocked = s.contacts.filter((c) => c.blocked);
  return (
    <Page title={t('phone')}>
      <Group>
        <Row title={t('settings_my_number')} value={s.me.number} />
      </Group>
      <Group footer={t('settings_your_number_is_hidden_from_the')}>
        <Flip k="hideCallerId" title={t('settings_hide_caller_id')} />
      </Group>
      <Group header={t('settings_blocked_contacts')} footer={t('settings_blocked_contacts_cannot_call_or_message')}>
        {blocked.map((c) => (
          <Row
            key={c.id}
            title={c.name}
            sub={c.number}
            right={
              <button className="tint" onClick={() => update(() => (c.blocked = false))}>
                {t('settings_unblock')}
              </button>
            }
          />
        ))}
        {!blocked.length && <Row title={<span className="muted">{t('settings_no_blocked_contacts')}</span>} />}
      </Group>
    </Page>
  );
}

function General() {
  const s = useS();
  const nav = useNav();
  return (
    <Page title={t('settings_general')}>
      <Group>
        <Row
          title={t('settings_about')}
          chevron
          onClick={() =>
            nav.push(
              <Page title={t('settings_about')}>
                <Group>
                  <Row title={t('name')} value={t('settings_ns_phone', { n: S.me.name.split(' ')[0] })} />
                  <Row title={t('settings_software_version')} value="1.0" />
                  <Row title={t('settings_model')} value={t('settings_phone_pro')} />
                  <Row title={t('settings_phone_number')} value={S.me.number} />
                </Group>
                <Group>
                  <Row title={t('apps')} value={S.apps.length + S.dock.length} />
                  <Row title={t('photos')} value={S.photos.length} />
                  <Row title={t('settings_capacity')} value={t('settings_256_gb')} />
                </Group>
              </Page>,
            )
          }
        />
      </Group>
      <Group header={t('settings_date_time')}>
        <Row title={t('settings_24_hour_time')} right={<Toggle label={t('settings_24_hour_time')} on={s.settings.clock24} onChange={(v) => set('clock24', v)} />} />
      </Group>
      <Group>
        <Row tone="danger" title={t('settings_erase_all_content_and_settings')} onClick={() => confirm(t('settings_erase_phone'), t('settings_all_data_on_this_phone_will'), t('settings_erase'), () => window.location.reload())} />
      </Group>
    </Page>
  );
}

function Root() {
  const s = useS();
  const nav = useNav();
  const st = s.settings;
  return (
    <Page title={t('settings_settings')} large>
      <Group>
        <Row
          className="tall"
          icon={<Avatar name={s.me.name} size={58} />}
          title={<b className="big">{s.me.name}</b>}
          sub={`${s.me.number} · ${s.me.email}`}
          chevron
          onClick={() => prompt(t('settings_your_name'), t('name'), (v) => update((x) => (x.me.name = v)), s.me.name)}
        />
      </Group>
      <Group>
        <Flip k="airplane" title={t('airplane_mode')} icon={<Plane size={18} fill="currentColor" strokeWidth={0} />} bg="var(--orange)" />
        <Flip k="wifi" title={t('wi_fi')} icon={<Wifi size={18} strokeWidth={2.6} />} bg="var(--blue)" />
        <Flip k="bluetooth" title={t('bluetooth')} icon={<Bluetooth size={18} strokeWidth={2.6} />} bg="var(--blue)" />
        <Flip k="cellular" title={t('mobile_data')} icon={<Signal size={18} strokeWidth={3} />} bg="var(--green)" />
      </Group>
      <Group>
        <Row icon={<Bell size={18} fill="currentColor" />} iconBg="var(--red)" title={t('notifications')} chevron onClick={() => nav.push(<Notifications />)} />
        <Row icon={<Volume2 size={18} fill="currentColor" />} iconBg="var(--pink)" title={t('settings_sounds_haptics')} chevron onClick={() => nav.push(<Sounds />)} />
        <Flip k="dnd" title={t('do_not_disturb')} icon={<Moon size={17} fill="currentColor" strokeWidth={0} />} bg="var(--indigo)" />
        <Flip k="streamer" title={t('streamer_mode')} icon={<Radio size={18} />} bg="var(--purple)" sub={st.streamer ? t('settings_photos_and_media_are_blurred') : undefined} />
      </Group>
      <Group>
        <Row icon={<Gear size={18} />} iconBg="var(--gray)" title={t('settings_general')} chevron onClick={() => nav.push(<General />)} />
        <Row icon={<Sun size={18} fill="currentColor" />} iconBg="var(--blue)" title={t('settings_display_brightness')} chevron onClick={() => nav.push(<Display />)} />
        <Row icon={<ImageIcon size={18} />} iconBg="var(--teal)" title={t('settings_wallpaper')} chevron onClick={() => nav.push(<Wallpaper />)} />
        <Row icon={<ScanFace size={18} />} iconBg="var(--green)" title={t('settings_face_unlock_passcode')} chevron onClick={() => nav.push(<Passcode />)} />
        <Row icon={<Phone size={17} fill="currentColor" strokeWidth={0} />} iconBg="var(--green)" title={t('phone')} chevron onClick={() => nav.push(<PhoneSettings />)} />
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
