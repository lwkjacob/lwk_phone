import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, ChevronLeft, ChevronRight, Cloud, CloudRain, CloudSun, MapPin, Moon, Play, Search as SearchIcon, Sun, User } from 'lucide-react';
import type { Msg } from './data';
import { sfx } from './sound';
import { fmtAgo, fmtDur, fmtTime, money, uid, useNow, view } from './store';

/* ---------- navigation stack: iOS push / pop ---------- */

type Nav = { push: (node: ReactNode) => void; pop: () => void; depth: number };
const NavCtx = createContext<Nav>({ push: () => {}, pop: () => {}, depth: 0 });
export const useNav = () => useContext(NavCtx);

type Entry = { key: number; node: ReactNode; leaving?: boolean };

/** Pushed nodes must read their data from the store (pass ids, not objects) so they stay live. */
export function Stack({ children }: { children: ReactNode }) {
  const [pages, setPages] = useState<Entry[]>([]);
  const nav = useMemo(
    () => ({
      push: (node: ReactNode) => setPages((p) => [...p, { key: uid(), node }]),
      pop: () =>
        setPages((p) => {
          const top = p.filter((e) => !e.leaving).pop();
          return p.map((e) => (e === top ? { ...e, leaving: true } : e));
        }),
    }),
    [],
  );
  const covered = (i: number) => pages.slice(i).some((p) => !p.leaving);
  return (
    <div className="stack">
      <NavCtx.Provider value={{ ...nav, depth: 0 }}>
        <div className={`stack-pg ${covered(0) ? 'under' : ''}`}>{children}</div>
      </NavCtx.Provider>
      {pages.map((e, i) => (
        <NavCtx.Provider key={e.key} value={{ ...nav, depth: i + 1 }}>
          <div
            className={`stack-pg push ${e.leaving ? 'leaving' : ''} ${covered(i + 1) ? 'under' : ''}`}
            onAnimationEnd={(ev) => e.leaving && ev.target === ev.currentTarget && setPages((p) => p.filter((x) => x.key !== e.key))}
          >
            {e.node}
          </div>
        </NavCtx.Provider>
      ))}
    </div>
  );
}

export function Page({ title, large, left, right, children, footer, back, className = '' }: {
  title?: ReactNode;
  large?: boolean;
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  back?: string | false;
  className?: string;
}) {
  const nav = useNav();
  return (
    <div className={`pg ${className}`}>
      <header className="nav">
        <div className="nav-l">
          {nav.depth > 0 && back !== false && (
            <button className="nav-back" onClick={nav.pop}>
              <ChevronLeft size={28} strokeWidth={2.2} />
              {back ?? 'Back'}
            </button>
          )}
          {left}
        </div>
        {!large && <div className="nav-t">{title}</div>}
        <div className="nav-r">{right}</div>
      </header>
      <div className="pg-body">
        {large && <h1 className="lg-title">{title}</h1>}
        {children}
      </div>
      {footer}
    </div>
  );
}

export type Tab = { id: string; label: string; icon: ReactNode; badge?: number; view: ReactNode };
export function Tabs({ tabs, initial, accessory }: { tabs: Tab[]; initial?: string; accessory?: ReactNode }) {
  const [tab, setTab] = useState(initial ?? tabs[0].id);
  const cur = tabs.find((t) => t.id === tab) ?? tabs[0];
  return (
    <div className="tabs">
      <div className="tabs-view">
        <Stack key={cur.id}>{cur.view}</Stack>
      </div>
      {accessory}
      <nav className="tabbar" aria-label="Tabs">
        {tabs.map((t) => (
          <button key={t.id} aria-current={t.id === cur.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            <span className="tab-ic">
              {t.icon}
              {!!t.badge && <span className="badge">{t.badge}</span>}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ---------- grouped lists ---------- */

export function Group({ header, footer, children }: { header?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="grp">
      {header && <h2 className="grp-h">{header}</h2>}
      <div className="grp-box">{children}</div>
      {footer && <p className="grp-f">{footer}</p>}
    </section>
  );
}

export function Row({ icon, iconBg, title, sub, value, chevron, onClick, right, tone, className = '' }: {
  icon?: ReactNode;
  iconBg?: string;
  title: ReactNode;
  sub?: ReactNode;
  value?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  right?: ReactNode;
  tone?: 'danger' | 'tint';
  className?: string;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`row ${tone ?? ''} ${className}`} onClick={onClick}>
      {icon && (
        <span className={iconBg ? 'row-ic' : 'row-lead'} style={iconBg ? { background: iconBg } : undefined}>
          {icon}
        </span>
      )}
      <span className="row-main">
        <span className="row-t">{title}</span>
        {sub && <span className="row-s">{sub}</span>}
      </span>
      {value != null && <span className="row-v">{value}</span>}
      {right}
      {chevron && <ChevronRight className="row-ch" size={18} strokeWidth={2.5} />}
    </Tag>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="tog" onClick={() => onChange(!on)}>
      <i />
    </button>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group">
      {options.map(([id, label]) => (
        <button key={id} aria-pressed={id === value} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Search({ value, onChange, placeholder = 'Search', autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <label className="search">
      <SearchIcon size={17} strokeWidth={2.4} />
      <input aria-label={placeholder} placeholder={placeholder} value={value} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** Live analogue clock. `offset` is a UTC offset in hours; omit for local time. */
export function ClockFace({ offset, size = 60, numbers }: { offset?: number; size?: number; numbers?: boolean }) {
  const now = useNow();
  const d = new Date(now + (offset == null ? 0 : (offset * 60 + new Date().getTimezoneOffset()) * 60_000));
  const sec = d.getSeconds();
  const min = d.getMinutes() + sec / 60;
  const hr = (d.getHours() % 12) + min / 60;
  const hand = (deg: number, len: number, w: number, cls: string) => <line x1="50" y1={50 + (cls === 'cf-s' ? 10 : 0)} x2="50" y2={50 - len} strokeWidth={w} strokeLinecap="round" className={cls} transform={`rotate(${deg} 50 50)`} />;
  return (
    <svg className="clockface" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="49" className="cf-bg" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        return numbers ? (
          <text key={i} x={50 + Math.sin(a) * 38} y={50 - Math.cos(a) * 38} className="cf-n" textAnchor="middle" dominantBaseline="central">
            {i || 12}
          </text>
        ) : (
          <line key={i} x1="50" y1="6" x2="50" y2={i % 3 ? 10 : 13} className="cf-t" strokeWidth={i % 3 ? 1.2 : 2.4} transform={`rotate(${i * 30} 50 50)`} />
        );
      })}
      {hand(hr * 30, 24, 4.2, 'cf-h')}
      {hand(min * 6, 38, 3, 'cf-h')}
      {hand(sec * 6, 40, 1.2, 'cf-s')}
      <circle cx="50" cy="50" r="2.4" className="cf-s" />
    </svg>
  );
}

export function Empty({ icon, title, text }: { icon: ReactNode; title: string; text?: string }) {
  return (
    <div className="empty" role="status">
      {icon}
      <strong>{title}</strong>
      {text && <span>{text}</span>}
    </div>
  );
}

/* ---------- generated imagery: no bundled or remote photos ---------- */

/** A soft mesh gradient per seed. Only blurred blobs, never hard colour stops: those alias into jagged edges. */
export function picBg(seed: number) {
  const h = (seed * 137) % 360; // golden-angle steps keep neighbouring seeds visually distinct
  const at = (a: number, b: number) => `${(seed * a) % 100}% ${(seed * b) % 100}%`;
  return [
    `radial-gradient(75% 65% at ${at(13, 7)}, hsl(${h + 45} 100% 80% / 0.95), transparent 72%)`,
    `radial-gradient(85% 75% at ${at(29, 53)}, hsl(${h + 290} 85% 46% / 0.9), transparent 70%)`,
    `radial-gradient(60% 55% at ${at(71, 31)}, hsl(${h + 170} 90% 62% / 0.75), transparent 72%)`,
    `linear-gradient(${(seed * 31) % 180}deg, hsl(${h} 78% 50%), hsl(${h + 75} 82% 62%))`,
  ].join(',');
}

export function Pic({ seed, className = '', alt = 'Photo', children, style, onClick }: { seed: number; className?: string; alt?: string; children?: ReactNode; style?: CSSProperties; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`pic ${className}`} style={{ background: picBg(seed), ...style }} role={onClick ? undefined : 'img'} aria-label={alt} onClick={onClick}>
      {children}
    </Tag>
  );
}

export const WEATHER_ICONS = { sun: Sun, cloudsun: CloudSun, cloud: Cloud, rain: CloudRain, moon: Moon } as const;

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export function Avatar({ name, size = 40, tint, seed }: { name: string; size?: number; tint?: boolean; seed?: number }) {
  const letters = /^[\d+(]/.test(name) ? '' : name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const hue = hash(name) % 360;
  const background = seed != null ? picBg(seed) : tint ? `linear-gradient(hsl(${hue} 62% 62%), hsl(${hue} 62% 44%))` : undefined;
  return (
    <span className="ava" style={{ width: size, height: size, fontSize: size * 0.4, background }} aria-hidden="true">
      {seed != null ? null : letters || <User size={size * 0.56} fill="currentColor" strokeWidth={0} />}
    </span>
  );
}

/* ---------- sheets ---------- */

export function Sheet({ title, onClose, action, children, cancel = 'Cancel', fit }: {
  title?: string;
  onClose: () => void;
  action?: { label: string; disabled?: boolean; run: () => void };
  children: ReactNode | ((close: () => void) => ReactNode);
  cancel?: string;
  fit?: boolean;
}) {
  const [closing, setClosing] = useState(false);
  const close = () => setClosing(true);
  const host = document.getElementById('overlay');
  if (!host) return null;
  return createPortal(
    <div className={`sheet-wrap ${closing ? 'closing' : ''}`} onAnimationEnd={(e) => closing && e.target === e.currentTarget && onClose()}>
      <div className="sheet-dim" onClick={close} />
      <div className={`sheet ${fit ? 'fit' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="sheet-nav">
          <button onClick={close}>{cancel}</button>
          <strong>{title}</strong>
          {action ? (
            <button className="bold" disabled={action.disabled} onClick={() => (action.run(), close())}>
              {action.label}
            </button>
          ) : (
            <span />
          )}
        </header>
        <div className="sheet-body">{typeof children === 'function' ? children(close) : children}</div>
      </div>
    </div>,
    host,
  );
}

/** Labelled text inputs for sheets and forms. */
export function Field({ label, value, onChange, placeholder, type = 'text', area }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; area?: boolean }) {
  return (
    <label className={`field ${area ? 'area' : ''}`}>
      <span>{label}</span>
      {area ? (
        <textarea value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} rows={4} />
      ) : (
        <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

/* ---------- chat ---------- */

export function Composer({ onSend, placeholder = 'Message', left }: { onSend: (text: string) => void; placeholder?: string; left?: ReactNode }) {
  const [v, setV] = useState('');
  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (!v.trim()) return;
        onSend(v.trim());
        setV('');
      }}
    >
      {left}
      <div className="composer-in">
        <input aria-label={placeholder} placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} />
        {v.trim() && (
          <button type="submit" aria-label="Send" className="composer-send">
            <ArrowUp size={18} strokeWidth={3} />
          </button>
        )}
      </div>
    </form>
  );
}

const BARS = [5, 9, 14, 8, 16, 11, 6, 13, 17, 9, 5, 12, 15, 7, 10, 14, 6, 9, 12, 5];
export function Wave({ count = 20, live }: { count?: number; live?: boolean }) {
  return (
    <span className={`wave ${live ? 'live' : ''}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <i key={i} style={{ height: BARS[i % BARS.length], animationDelay: `${(i % 7) * -0.13}s` }} />
      ))}
    </span>
  );
}

export function Bubbles({ msgs, who, typing, empty }: { msgs: Msg[]; who?: (from: string) => string; typing?: boolean; empty?: string }) {
  const end = useRef<HTMLDivElement>(null);
  // Not scrollIntoView: mid push-animation it scrolls the whole navigation stack sideways.
  useLayoutEffect(() => {
    const scroller = end.current?.closest('.pg-body');
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [msgs.length, typing]);
  return (
    <div className="bubbles">
      {!msgs.length && empty && <p className="bubbles-empty">{empty}</p>}
      {msgs.map((x, i) => {
        const prev = msgs[i - 1];
        const next = msgs[i + 1];
        const tail = !next || !!next.me !== !!x.me || next.from !== x.from;
        return (
          <div key={x.id} className="bub-row">
            {(!prev || x.time - prev.time > 3_600_000) && (
              <time className="bub-time">
                {Date.now() - x.time < 86_400_000 ? 'Today' : fmtAgo(x.time)} {fmtTime(x.time, true)}
              </time>
            )}
            {who && x.from && (!prev || prev.from !== x.from) && <span className="bub-from">{who(x.from)}</span>}
            <div className={`bub ${x.me ? 'me' : ''} ${tail ? 'tail' : ''} ${x.text ? '' : 'media'}`}>
              {x.text}
              {x.pic != null && <Pic seed={x.pic} className="bub-pic ugc" />}
              {x.gif != null && (
                <Pic seed={x.gif} className="bub-pic gif">
                  <b>GIF</b>
                </Pic>
              )}
              {x.loc && (
                <span className="bub-loc">
                  <span className="bub-map">
                    <MapPin size={26} fill="currentColor" stroke="#fff" />
                  </span>
                  <b>{x.loc}</b>
                  <small>Shared location</small>
                </span>
              )}
              {x.money != null && (
                <span className="bub-money">
                  <small>{x.me ? 'You sent' : 'You received'}</small>
                  <b>{money(x.money, 0)}</b>
                </span>
              )}
              {x.voice != null && (
                <span className="bub-voice">
                  <Play size={16} fill="currentColor" />
                  <Wave count={16} />
                  {fmtDur(x.voice)}
                </span>
              )}
            </div>
          </div>
        );
      })}
      {typing && (
        <div className="bub tail typing" aria-label="Typing">
          <i />
          <i />
          <i />
        </div>
      )}
      <div ref={end} />
    </div>
  );
}

const KEYS = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];
export function DialPad({ onKey, digits }: { onKey: (k: string) => void; digits?: boolean }) {
  return (
    <div className="pad">
      {KEYS.map(([k, sub]) =>
        digits && (k === '*' || k === '#') ? (
          <span key={k} />
        ) : (
          <button key={k} type="button" onClick={() => (sfx({ key: k }), onKey(k))}>
            <b>{k}</b>
            {!digits || k !== '0' ? <small>{sub}</small> : null}
          </button>
        ),
      )}
    </div>
  );
}

/* ---------- pointer drag scrolling (mouse users can't flick) ---------- */

export function useDragScroll<T extends HTMLElement>(axis: 'x' | 'y' = 'x', paged = false) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prop = axis === 'x' ? 'scrollLeft' : 'scrollTop';
    let start = 0;
    let from = 0;
    let down = false;
    let moved = false;
    const at = (e: PointerEvent) => (axis === 'x' ? e.clientX : e.clientY);
    const onDown = (e: PointerEvent) => {
      if (e.button || (e.target as Element).closest('[data-nodrag]')) return;
      down = true;
      moved = false;
      start = at(e);
      from = el[prop];
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      // The phone is zoomed, so pointer pixels are not layout pixels.
      const d = (at(e) - start) / view.k;
      if (!moved && Math.abs(d) < 6) return;
      moved = true;
      el.classList.add('dragging');
      el[prop] = from - d;
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      if (!moved) return;
      if (paged) {
        const size = axis === 'x' ? el.clientWidth : el.clientHeight;
        const delta = el[prop] - from;
        const page = Math.round(from / size) + (Math.abs(delta) > size * 0.12 ? Math.sign(delta) : 0);
        el.scrollTo({ [axis === 'x' ? 'left' : 'top']: page * size, behavior: 'smooth' });
        window.setTimeout(() => el.classList.remove('dragging'), 380);
      } else el.classList.remove('dragging');
    };
    const onClick = (e: MouseEvent) => {
      if (!moved) return;
      moved = false;
      e.stopPropagation();
      e.preventDefault();
    };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('click', onClick, true);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('click', onClick, true);
    };
  }, [axis, paged]);
  return ref;
}
