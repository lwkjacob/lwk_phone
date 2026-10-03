import { useEffect, useState, type PointerEvent as RPointerEvent } from 'react';
import { Camera, Flashlight, Lock as LockIcon, LockOpen, X } from 'lucide-react';
import { AppIcon } from '../apps';
import { sfx } from '../sound';
import { S, fmtAgo, fmtTime, openApp, tapNotif, unlock, update, useNow, useS } from '../store';
import { DialPad } from '../ui';

const longDate = (t: number) => new Date(t).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

function NotifList({ locked }: { locked?: boolean }) {
  const s = useS();
  return (
    <div className="nlist">
      {s.notifs.map((nf) => (
        <button key={nf.id} className="ncard" onClick={() => (tapNotif(nf), locked && unlock())}>
          <AppIcon id={nf.app} size={38} />
          <span className="banner-txt">
            <b>{nf.title}</b>
            <span>{nf.body}</span>
          </span>
          <time>{fmtAgo(nf.time)}</time>
        </button>
      ))}
    </div>
  );
}

function Passcode() {
  const [code, setCode] = useState('');
  const [bad, setBad] = useState(false);
  const key = (k: string) => {
    const next = (code + k).slice(0, 4);
    setCode(next);
    if (next.length < 4) return;
    window.setTimeout(() => {
      if (next === S.settings.passcode) return unlock(true);
      sfx('end');
      setBad(true);
      setCode('');
      window.setTimeout(() => setBad(false), 450);
    }, 140);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) key(e.key);
      else if (e.key === 'Backspace') setCode((c) => c.slice(0, -1));
      else if (e.key === 'Escape') update((s) => (s.passPad = false));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="passcode" role="dialog" aria-label="Enter passcode">
      <p>Enter Passcode</p>
      <div className={`pass-dots ${bad ? 'shake' : ''}`} aria-label={`${code.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={i < code.length ? 'on' : ''} />
        ))}
      </div>
      <DialPad digits onKey={key} />
      <div className="pass-foot">
        <button onClick={() => update((s) => (s.passPad = false))}>Cancel</button>
        <button onClick={() => setCode(code.slice(0, -1))} disabled={!code}>
          Delete
        </button>
      </div>
    </div>
  );
}

export function Lock() {
  const s = useS();
  const now = useNow(5000);
  // Swipe up anywhere to unlock; a plain click does nothing, like the real thing.
  const onDown = (e: RPointerEvent) => {
    const y = e.clientY;
    window.addEventListener('pointerup', (u) => y - u.clientY > 60 && unlock(), { once: true });
  };
  return (
    <div className={`lock ${s.locked ? '' : 'gone'}`} data-wall={s.settings.lockWallpaper} inert={!s.locked} onPointerDown={onDown}>
      <div className={`lock-body ${s.passPad ? 'blurred' : ''}`}>
        <div className="lock-top">
          {s.unlocking ? <LockOpen size={22} strokeWidth={2.6} className="lock-glyph open" /> : <LockIcon size={22} strokeWidth={2.6} className="lock-glyph" />}
          <div className="lock-date">{longDate(now)}</div>
          <div className="lock-time">{fmtTime(now)}</div>
        </div>
        <div className="lock-notifs">
          <NotifList locked />
        </div>
        <div className="lock-actions">
          <button aria-label="Flashlight" aria-pressed={s.flashlight} onClick={() => update((x) => (x.flashlight = !x.flashlight))}>
            <Flashlight size={22} fill={s.flashlight ? 'currentColor' : 'none'} />
          </button>
          <span className="lock-hint">Swipe up to open</span>
          <button aria-label="Camera" onClick={() => (openApp('camera'), unlock())}>
            <Camera size={22} fill="currentColor" stroke="var(--lock-btn, #3a3a3c)" />
          </button>
        </div>
      </div>
      {s.passPad && <Passcode />}
    </div>
  );
}

export function NotificationCenter() {
  const s = useS();
  const now = useNow(5000);
  const close = () => update((x) => (x.nc = false));
  return (
    <div className={`nc ${s.nc ? 'show' : ''}`} inert={!s.nc} onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="lock-top">
        <div className="lock-date">{longDate(now)}</div>
        <div className="lock-time">{fmtTime(now)}</div>
      </div>
      <div className="nc-head">
        <h2>Notification Center</h2>
        {s.notifs.length > 0 && (
          <button aria-label="Clear all notifications" onClick={() => update((x) => (x.notifs = []))}>
            <X size={15} strokeWidth={3} />
          </button>
        )}
      </div>
      <div className="lock-notifs">{s.notifs.length ? <NotifList /> : <p className="nc-empty">No Notifications</p>}</div>
    </div>
  );
}
