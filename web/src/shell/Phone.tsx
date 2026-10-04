import { Component, useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { Check, Phone as PhoneIcon, Plane, X } from 'lucide-react';
import { APPS, AppIcon, type AppDef } from '../apps';
import { nearby, songs } from '../data';
import { sfx } from '../sound';
import { S, finishClose, fmtDur, fmtTime, goHome, lock, nameOf, openApp, sendMsg, tapNotif, unlock, update, useNow, useS, view, type AlertDef, type Notif, type ShareDef } from '../store';
import { rpc } from '../net';
import { inGame, loadApp } from '../nui';
import { theme } from '../theme';
import { Avatar, LoadError, Pic, Skeleton, Wave } from '../ui';
import { CallScreen } from './Call';
import { ControlCenter } from './ControlCenter';
import { Home } from './Home';
import { Lock, NotificationCenter } from './Lock';
import { Setup } from './Setup';
import { t } from '../i18n';

const H = 878; // screen 852 + bezel

function useScale(size: number, focus: boolean, landscape: boolean) {
  const [vp, setVp] = useState([window.innerWidth, window.innerHeight]);
  useEffect(() => {
    const f = () => setVp([window.innerWidth, window.innerHeight]);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  // In-game the phone takes ~72% of the screen height, like other FiveM phones.
  // Sideways, the long edge runs across the screen, so width becomes the limit.
  return Math.min((vp[1] * (focus ? 0.94 : 0.72)) / (landscape ? 419 : H), (vp[0] * 0.92) / (landscape ? H : 419), landscape ? (vp[1] * 0.72) / 419 : Infinity) * size;
}

export function Phone() {
  const s = useS();
  const k = useScale(s.settings.size, s.focus, s.landscape);
  const def = s.app ? APPS[s.app] : null;
  const dark = def ? (def.dark ?? s.settings.dark) : s.settings.dark;
  const callUp = !!s.call && !s.call.min;
  const lightBar = s.setup ? s.settings.dark : s.locked || s.cc || s.nc || s.search || callUp || !def || s.closing || (def.bar ? def.bar === 'light' : dark);
  const peek = !s.open && !!s.banner;
  useEffect(() => void rpc('flashlight', { on: s.flashlight && s.open }), [s.flashlight, s.open]);
  view.k = k;

  return (
    <div className={`phone ${s.open ? 'open' : peek ? 'peek' : ''} ${s.focus ? 'focus' : ''} ${s.landscape ? 'landscape' : ''}`} style={{ '--k': k } as CSSProperties} aria-hidden={!s.open && !peek}>
      {/* zoom, not transform: scale(). Zoom re-lays the phone out at its real size, so text and hairlines land on device pixels and stay sharp. */}
      <div className="phone-body" style={{ zoom: k, '--frame': s.settings.frame === 'custom' ? s.settings.frameColor : undefined } as CSSProperties} data-frame={s.settings.frame}>
      <button className="hw hw-action" tabIndex={-1} aria-label={t('sys_toggle_silent_mode')} onClick={() => update((x) => (x.settings.silent = !x.settings.silent))} />
      <button className="hw hw-up" tabIndex={-1} aria-label={t('sys_volume_up')} onClick={() => update((x) => (x.settings.volume = Math.min(1, x.settings.volume + 0.1)))} />
      <button className="hw hw-down" tabIndex={-1} aria-label={t('sys_volume_down')} onClick={() => update((x) => (x.settings.volume = Math.max(0, x.settings.volume - 0.1)))} />
      <button className="hw hw-power" tabIndex={-1} aria-label={t('sys_lock')} onClick={() => (S.locked ? unlock() : lock())} />
      <div className="bezel">
        <div id="screen" data-island={theme.island} className={`screen ${s.landscape ? 'landscape' : ''} ${lightBar ? 'bar-light' : 'bar-dark'} ${s.settings.streamer ? 'streamer' : ''}`} data-theme={s.settings.dark ? 'dark' : 'light'}>
          {/* Hidden once something opaque covers it: nothing to composite, and no colour fringe at the rounded corners. */}
          <div className={`wall ${s.locked || (def && !s.closing) ? 'covered' : ''}`} data-wall={s.settings.wallpaper} />
          <Home />
          {def && <AppHost key={def.id} def={def} dark={dark} />}
          <Lock />
          <Setup />
          <CallScreen />
          <NotificationCenter />
          <ControlCenter />
          <EdgeZones />
          <StatusBar />
          <Island />
          <HomeBar />
          {/* Banners and dialogs turn with the content, so they read upright when the phone is sideways. */}
          <div className={`sys-rot ${s.landscape ? 'app-rot landscape' : ''}`}>
            <Banner />
            <Dialogs />
          </div>
          <div className="screen-dim" style={{ opacity: (1 - s.settings.brightness) * 0.75 }} />
        </div>
      </div>
      </div>
    </div>
  );
}

/* ---------- running app ---------- */

class Guard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error('[phone]', err);
    // A crashing app drops back to the home screen instead of freezing the phone.
    update((s) => ((s.app = null), (s.closing = false)));
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Shows a placeholder while an app's data is on its way, and a retry screen if it never arrives. */
function Loaded({ def, children }: { def: AppDef; children: ReactNode }) {
  const s = useS();
  const state = s.loaded[def.id];
  useEffect(() => {
    // In-game, reopening an app refreshes it (the old data stays on screen meanwhile).
    if (def.data && (inGame || !S.loaded[def.id])) loadApp(def.id);
  }, [def]);
  // In the browser on a "fast" network the data is already here: skip the placeholder rather than flash it.
  if (!def.data || state === 'ready' || (!inGame && s.net === 'fast' && !s.settings.airplane && state !== 'error')) return <>{children}</>;
  if (state === 'error') return <LoadError onRetry={() => loadApp(def.id)} offline={s.settings.airplane} />;
  return <Skeleton kind={def.data} />;
}

function AppHost({ def, dark }: { def: AppDef; dark: boolean }) {
  const s = useS();
  const View = def.view;
  return (
    <div
      className={`app ${s.closing ? 'closing' : ''}`}
      data-theme={dark ? 'dark' : 'light'}
      data-app={def.id}
      // The app scales to and from the icon's own box, so it lands on the icon instead of on a tall sliver beside it.
      style={{ transformOrigin: `${s.origin.x}px ${s.origin.y}px`, '--sx': s.origin.w ? s.origin.w / 393 : 0.15, '--sy': s.origin.h ? s.origin.h / 852 : 0.15 } as CSSProperties}
      onAnimationEnd={(e) => e.target === e.currentTarget && finishClose()}
    >
      {/* Counter-rotated when the phone is sideways, so the app lays out for an 852 x 393 screen. */}
      <div className={`app-rot ${s.landscape ? 'landscape' : ''}`}>
        <Guard>
          <Loaded def={def}>
            <View />
          </Loaded>
        </Guard>
        {/* Sheets and full-screen viewers portal here: inside the app, so they animate and close with it. */}
        <div id="overlay" />
        {s.landscape && (
          <button className="homebar land" aria-label={t('home')} onClick={goHome}>
            <i />
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- system chrome ---------- */

function StatusBar() {
  const s = useS();
  const now = useNow(5000);
  const { airplane, wifi, cellular } = s.settings;
  return (
    <div className="status" aria-hidden="true">
      <span className="status-time">{fmtTime(now)}</span>
      <span className="status-r">
        {airplane ? (
          <Plane size={15} fill="currentColor" strokeWidth={0} />
        ) : (
          <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor" className={cellular ? '' : 'off'}>
            <rect x="0" y="7.5" width="3" height="4.5" rx="1" />
            <rect x="5" y="5" width="3" height="7" rx="1" />
            <rect x="10" y="2.5" width="3" height="9.5" rx="1" />
            <rect x="15" y="0" width="3" height="12" rx="1" />
          </svg>
        )}
        {!airplane && wifi && (
          <svg width="17" height="12" viewBox="0 0 17 12" fill="none" stroke="currentColor" strokeWidth="2.1">
            <path d="M1.2 4.3a10.3 10.3 0 0 1 14.6 0" />
            <path d="M3.9 7a6.5 6.5 0 0 1 9.2 0" />
            <path d="M6.4 9.6a3 3 0 0 1 4.2 0L8.5 11.9Z" fill="currentColor" stroke="none" />
          </svg>
        )}
        <span className="battery">
          <i style={{ width: '78%' }} />
        </span>
      </span>
    </div>
  );
}

function Island() {
  const s = useS();
  const now = useNow();
  const c = s.call;
  const song = songs.find((x) => x.id === s.music.id);
  if (c && c.min)
    return (
      <button className="island wide" aria-label={t('sys_return_to_call')} onClick={() => update((x) => x.call && (x.call.min = false))}>
        <span className="isl-green">
          <PhoneIcon size={15} fill="currentColor" strokeWidth={0} />
          {c.state === 'active' ? fmtDur(Math.max(0, (now - c.start) / 1000)) : t('sys_calling')}
        </span>
        <Wave count={6} live />
      </button>
    );
  if (s.rec)
    return (
      <button className="island wide" aria-label={t('sys_recording')} onClick={(e) => openApp('memos', e.currentTarget)}>
        <span className="isl-red">
          <i className="rec-dot" />
          {fmtDur(Math.max(0, (now - s.rec) / 1000))}
        </span>
        <Wave count={6} live />
      </button>
    );
  if (song && s.music.playing && s.app !== 'music' && !c)
    return (
      <button className="island wide" aria-label={t('sys_now_playing_title', { title: song.title })} onClick={(e) => openApp('music', e.currentTarget)}>
        <Pic seed={song.seed} className="isl-art" />
        <Wave count={5} live />
      </button>
    );
  return <div className="island" />;
}

/** Top corners: left pulls down notifications, right pulls down Control Center (click or drag). */
function EdgeZones() {
  const s = useS();
  const pull = (which: 'nc' | 'cc') => (e: RPointerEvent) => {
    const y = e.clientY;
    window.addEventListener('pointerup', (u) => u.clientY - y > -8 && update((x) => ((x.cc = x.nc = false), (x[which] = true))), { once: true });
  };
  if (s.cc || s.nc || s.landscape || (s.call && !s.call.min)) return null;
  return (
    <>
      {!s.locked && <button className="edge edge-l" aria-label={t('sys_open_notification_center')} onPointerDown={pull('nc')} />}
      <button className="edge edge-r" aria-label={t('sys_open_control_center')} onPointerDown={pull('cc')} />
    </>
  );
}

function HomeBar() {
  const s = useS();
  const act = () => (S.locked && !S.cc ? unlock() : goHome());
  const onDown = (e: RPointerEvent) => {
    const y = e.clientY;
    window.addEventListener('pointerup', (u) => u.clientY - y < 8 && act(), { once: true });
  };
  return (
    <button className={`homebar ${s.hideHomeBar && s.app ? 'faded' : ''}`} aria-label={t('home')} onPointerDown={onDown} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && act()}>
      <i />
    </button>
  );
}

function Banner() {
  const s = useS();
  const last = useRef<Notif | null>(null);
  if (s.banner) last.current = s.banner;
  const nf = last.current;
  if (!nf) return null;
  const show = !!s.banner && (!s.locked || !s.open);
  return (
    <button className={`banner ${show ? 'show' : ''}`} tabIndex={show ? 0 : -1} onClick={() => (update((x) => (x.open = true)), tapNotif(nf))}>
      <AppIcon id={nf.app} size={38} />
      <span className="banner-txt">
        <b>{nf.title}</b>
        <span>{nf.body}</span>
      </span>
      <time>{t('sys_now')}</time>
    </button>
  );
}

/* ---------- alerts, action sheets, share sheet ---------- */

function AlertView({ a }: { a: AlertDef }) {
  const [v, setV] = useState(a.value ?? '');
  const done = (b: AlertDef['buttons'][number]) => {
    update((s) => (s.ui.alert = null));
    b.run?.(v);
  };
  return (
    <div className="dlg-wrap">
      <div className="alert" role="alertdialog" aria-modal="true" aria-label={a.title}>
        <div className="alert-body">
          <strong>{a.title}</strong>
          {a.message && <p>{a.message}</p>}
          {a.image && <img className="alert-img" src={a.image} alt="" />}
          {a.input != null && (
            <input autoFocus aria-label={a.input} placeholder={a.input} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && done(a.buttons[a.buttons.length - 1])} />
          )}
        </div>
        <div className={`alert-btns ${a.buttons.length > 2 ? 'stacked' : ''}`}>
          {a.buttons.map((b) => (
            <button key={b.label} className={b.kind ?? ''} autoFocus={a.input == null && b.kind !== 'cancel'} onClick={() => done(b)}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShareSheet({ d }: { d: ShareDef }) {
  const s = useS();
  const [sent, setSent] = useState<string | number | null>(null);
  // In-game: the players standing close enough. The demo has a made-up few.
  const [people, setPeople] = useState<{ id: string | number; name: string }[]>(inGame ? [] : nearby.map((name) => ({ id: name, name })));
  useEffect(() => {
    if (inGame) rpc<{ people: { id: number; name: string }[] }>('share.nearby').then((r) => r?.ok && Array.isArray(r.people) && setPeople(r.people));
  }, []);
  const close = () => update((x) => (x.ui.share = null));
  const air = (id: string | number) => {
    setSent(id);
    sfx('sent');
    // Things with no form of their own (a post, a listing) arrive as a photo or a line of text.
    rpc('share.send', { to: id, item: d.item ?? (typeof d.seed === 'string' ? { kind: 'photo', label: d.label, seed: d.seed } : { kind: 'text', label: d.label }) });
    window.setTimeout(close, 1100);
  };
  return (
    <div className="dlg-wrap bottom" onClick={close}>
      <div className="share" role="dialog" aria-modal="true" aria-label={t('share')} onClick={(e) => e.stopPropagation()}>
        <header>
          {d.seed != null && <Pic seed={d.seed} className="share-thumb" />}
          <div>
            <strong>{d.label}</strong>
            <small>{d.kind}</small>
          </div>
          <button aria-label={t('close')} onClick={close}>
            <X size={16} strokeWidth={3} />
          </button>
        </header>
        <h3>{t('sys_airshare_nearby')}</h3>
        <div className="share-people">
          {!people.length && <p className="muted">{t('life_nobody_nearby')}</p>}
          {people.map(({ id, name: p }) => (
            <button key={id} onClick={() => air(id)}>
              <span className="share-ava">
                <Avatar name={p} size={58} />
                {sent === id && (
                  <span className="share-ok">
                    <Check size={26} strokeWidth={3} />
                  </span>
                )}
              </span>
              <span>{sent === id ? t('sent') : p.split(' ')[0]}</span>
            </button>
          ))}
        </div>
        <h3>{t('messages')}</h3>
        <div className="share-people">
          {s.chats.slice(0, 4).map((c) => {
            const name = c.name ?? nameOf(c.numbers[0]);
            return (
              <button key={c.id} onClick={() => (sendMsg(c.id, d.seed != null ? { pic: d.seed } : { text: d.label }), close())}>
                <Avatar name={name} size={58} tint />
                <span>{name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Dialogs() {
  const { alert, actions, share } = useS().ui;
  const closeActions = () => update((s) => (s.ui.actions = null));
  return (
    <>
      {share && <ShareSheet d={share} />}
      {actions && (
        <div className="dlg-wrap bottom" onClick={closeActions}>
          <div className="as" role="dialog" aria-modal="true" aria-label={actions.title ?? t('sys_actions')} onClick={(e) => e.stopPropagation()}>
            <div className="as-grp">
              {actions.title && <p>{actions.title}</p>}
              {actions.options.map((o) => (
                <button key={o.label} className={o.destructive ? 'destructive' : ''} onClick={() => (closeActions(), o.run())}>
                  {o.label}
                </button>
              ))}
            </div>
            <button className="as-cancel" onClick={closeActions}>
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
      {alert && <AlertView key={alert.title} a={alert} />}
    </>
  );
}
