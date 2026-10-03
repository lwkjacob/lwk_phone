import { useRef, useState, type MouseEvent, type PointerEvent as RPointerEvent } from 'react';
import { Minus, Phone, Search as SearchIcon } from 'lucide-react';
import { APPS, AppIcon, appEvent } from '../apps';
import { weather } from '../data';
import { S, badge, confirm, openApp, startCall, update, useS, view } from '../store';
import { Avatar, ClockFace, Search, WEATHER_ICONS, useDragScroll } from '../ui';

const WIDGET_APPS = ['weather', 'clock'];
const has = (id: string) => S.apps.includes(id) || S.dock.includes(id);

function moveApp(id: string, target: string) {
  update((s) => {
    const a = s.apps.includes(id) ? s.apps : s.dock;
    const b = s.apps.includes(target) ? s.apps : s.dock;
    const i = a.indexOf(id);
    const j = b.indexOf(target);
    if (a === b) {
      a.splice(i, 1);
      a.splice(j, 0, id);
    } else {
      // Dock holds exactly four, so crossing between dock and grid swaps.
      a[i] = target;
      b[j] = id;
    }
  });
}

function removeApp(id: string) {
  confirm(`Remove “${APPS[id].name}”?`, 'The app is removed from your Home Screen. You can install it again from the App Store.', 'Remove', () =>
    (appEvent(id, 'delete'), update((s) => (s.apps = s.apps.filter((x) => x !== id)))),
  );
}

function HomeIcon({ id, dock }: { id: string; dock?: boolean }) {
  const s = useS();
  const held = useRef(false);
  const def = APPS[id];
  const count = badge(id);

  const onDown = (e: RPointerEvent<HTMLButtonElement>) => {
    if (e.button) return;
    const el = e.currentTarget;
    const sx = e.clientX;
    const sy = e.clientY;
    held.current = false;
    if (!S.edit) {
      // Long press enters jiggle mode.
      const t = window.setTimeout(() => ((held.current = true), update((x) => (x.edit = true))), 550);
      const stop = () => (window.clearTimeout(t), window.removeEventListener('pointermove', move));
      const move = (m: PointerEvent) => Math.hypot(m.clientX - sx, m.clientY - sy) > 6 && stop();
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', stop, { once: true });
      return;
    }
    const k = view.k;
    const move = (m: PointerEvent) => {
      if (!held.current && Math.hypot(m.clientX - sx, m.clientY - sy) < 6) return;
      held.current = true;
      el.classList.add('lifted');
      el.style.transform = `translate(${(m.clientX - sx) / k}px, ${(m.clientY - sy) / k}px) scale(1.12)`;
    };
    const up = (u: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      el.classList.remove('lifted');
      el.style.transform = '';
      if (!held.current) return;
      const target = document.elementsFromPoint(u.clientX, u.clientY).map((x) => x.closest<HTMLElement>('[data-icon]')).find((x) => x && x !== el);
      if (target?.dataset.icon) moveApp(id, target.dataset.icon);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (held.current) return void (held.current = false);
    if (!S.edit) openApp(id, e.currentTarget.querySelector('.app-ic'));
  };

  return (
    <button className="hicon" data-icon={id} data-nodrag={s.edit ? '' : undefined} onPointerDown={onDown} onClick={onClick} aria-label={count ? `${def.name}, ${count} new` : def.name}>
      <span className="hicon-ic">
        <AppIcon id={id} size={60} />
        {!!count && <span className="badge">{count}</span>}
        {s.edit && !def.system && !dock && (
          <span className="hicon-del" onClick={(e) => (e.stopPropagation(), removeApp(id))}>
            <Minus size={14} strokeWidth={4} />
          </span>
        )}
      </span>
      {!dock && <span className="hicon-name">{def.name}</span>}
    </button>
  );
}

function Widgets() {
  const WIcon = WEATHER_ICONS[weather.hourly[0][1] as keyof typeof WEATHER_ICONS];
  return (
    <>
      {has('weather') && (
      <button className="widget" onClick={(e) => !S.edit && openApp('weather', e.currentTarget.firstElementChild)}>
        <span className="widget-box w-weather">
          <b>{weather.city}</b>
          <strong>{weather.temp}°</strong>
          <WIcon size={18} fill="#ffd60a" stroke="#ffd60a" />
          <span>{weather.cond}</span>
          <span>
            H:{weather.hi}° L:{weather.lo}°
          </span>
        </span>
        <span className="hicon-name">Weather</span>
      </button>
      )}
      {has('clock') && (
      <button className="widget" onClick={(e) => !S.edit && openApp('clock', e.currentTarget.firstElementChild)}>
        <span className="widget-box w-clock">
          <ClockFace size={138} numbers />
        </span>
        <span className="hicon-name">Clock</span>
      </button>
      )}
    </>
  );
}

function Spotlight() {
  const s = useS();
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const ids = [...s.dock, ...s.apps].filter((id) => APPS[id].name.toLowerCase().includes(term));
  const people = term ? s.contacts.filter((c) => c.name.toLowerCase().includes(term) || c.number.includes(term)) : [];
  return (
    <div className="spot" role="dialog" aria-label="Search">
      <div className="spot-bar">
        <Search value={q} onChange={setQ} autoFocus />
        <button onClick={() => update((x) => (x.search = false))}>Cancel</button>
      </div>
      {ids.length > 0 && <h3>{term ? 'Applications' : 'Suggestions'}</h3>}
      <div className="spot-apps">
        {(term ? ids : ids.slice(0, 8)).map((id) => (
          <button key={id} onClick={(e) => openApp(id, e.currentTarget)}>
            <AppIcon id={id} size={56} />
            <span>{APPS[id].name}</span>
          </button>
        ))}
      </div>
      {people.length > 0 && (
        <>
          <h3>Contacts</h3>
          <div className="spot-list">
            {people.map((c) => (
              <button key={c.id} onClick={() => (update((x) => (x.search = false)), startCall(c.number))}>
                <Avatar name={c.name} size={36} />
                <span>
                  <b>{c.name}</b>
                  <small>{c.number}</small>
                </span>
                <Phone size={18} fill="currentColor" strokeWidth={0} />
              </button>
            ))}
          </div>
        </>
      )}
      {term && !ids.length && !people.length && <p className="spot-none">No results for “{q}”</p>}
    </div>
  );
}

export function Home() {
  const s = useS();
  const ref = useDragScroll<HTMLDivElement>('x', true);
  const [page, setPage] = useState(0);
  const [scrolling, setScrolling] = useState(false);
  const timer = useRef(0);
  const behind = !!s.app && !s.closing;

  // Each widget on page 1 takes a 2x2 block out of the 4x6 grid; later pages are full.
  const first = 24 - 4 * WIDGET_APPS.filter(has).length;
  const pages = [s.apps.slice(0, first)];
  for (let i = first; i < s.apps.length; i += 24) pages.push(s.apps.slice(i, i + 24));

  const goTo = (i: number) => ref.current?.scrollTo({ left: i * ref.current.clientWidth, behavior: 'smooth' });
  const onScroll = () => {
    const el = ref.current!;
    setPage(Math.round(el.scrollLeft / el.clientWidth));
    setScrolling(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setScrolling(false), 1400);
  };
  const exitEdit = (e: MouseEvent) => s.edit && e.target === e.currentTarget && update((x) => (x.edit = false));

  return (
    <div className={`home ${behind ? 'behind' : ''} ${s.locked ? 'asleep' : ''} ${s.edit ? 'edit' : ''}`} inert={s.locked || behind}>
      <div className="home-pages" ref={ref} onScroll={onScroll} onWheel={(e) => goTo(Math.min(pages.length - 1, Math.max(0, page + Math.sign(e.deltaY))))}>
        {pages.map((ids, i) => (
          <div className="home-page" key={i} onClick={exitEdit}>
            {i === 0 && <Widgets />}
            {ids.map((id) => (
              <HomeIcon key={id} id={id} />
            ))}
          </div>
        ))}
      </div>
      {scrolling && pages.length > 1 ? (
        <div className="home-pill dots">
          {pages.map((_, i) => (
            <button key={i} aria-label={`Page ${i + 1}`} aria-current={i === page ? 'page' : undefined} onClick={() => goTo(i)} />
          ))}
        </div>
      ) : (
        <button className="home-pill" onClick={() => update((x) => (x.search = true))}>
          <SearchIcon size={11} strokeWidth={3} /> Search
        </button>
      )}
      <div className="dock">
        {s.dock.map((id) => (
          <HomeIcon key={id} id={id} dock />
        ))}
      </div>
      {s.edit && (
        <button className="home-done" onClick={() => update((x) => (x.edit = false))}>
          Done
        </button>
      )}
      {s.search && <Spotlight />}
    </div>
  );
}
