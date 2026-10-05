import { useRef, useState, type MouseEvent, type PointerEvent as RPointerEvent } from 'react';
import { flushSync } from 'react-dom';
import { Minus, Phone, Search as SearchIcon } from 'lucide-react';
import { APPS, AppIcon, appEvent } from '../apps';
import { weather } from '../data';
import { S, badge, confirm, openApp, startCall, update, useS, view, viewportRect } from '../store';
import { Avatar, ClockFace, Search, WEATHER_ICONS, useDragScroll } from '../ui';
import { t } from '../i18n';

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

/** Change the order of the icons in `box`, and slide each one from where it was to where it ends up. */
function shift(box: HTMLElement, change: () => void) {
  const icons = [...box.querySelectorAll<HTMLElement>('[data-icon]')];
  const before = icons.map((n) => [n.offsetLeft, n.offsetTop]);
  flushSync(change);
  icons.forEach((n, i) => {
    const dx = before[i][0] - n.offsetLeft;
    const dy = before[i][1] - n.offsetTop;
    if ((dx || dy) && n.isConnected && !n.classList.contains('lifted')) n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
  });
}

function removeApp(id: string) {
  confirm(t('sys_remove_name', { name: APPS[id].name }), t('sys_the_app_is_removed_from_your'), t('remove'), () =>
    (appEvent(id, 'delete'), update((s) => (s.apps = s.apps.filter((x) => x !== id)))),
  );
}

function HomeIcon({ id, dock }: { id: string; dock?: boolean }) {
  const s = useS();
  const held = useRef(false);
  const def = APPS[id];
  const count = badge(id);

  /* One press does it all: hold to start editing, keep holding and move to drag. The icon follows the
   * pointer, the others make room as it passes over them, and it settles into place on release. */
  const onDown = (e: RPointerEvent<HTMLButtonElement>) => {
    if (e.button) return;
    const el = e.currentTarget;
    const sx = e.clientX;
    const sy = e.clientY;
    held.current = false;
    // While lifted: where on the icon it was grabbed (viewport px from its centre) and its current offset (layout px).
    let drag: { gx: number; gy: number; tx: number; ty: number } | null = null;
    let over: string | null = null;
    let dwell = 0;
    let frame = 0;
    let last: PointerEvent | null = null;
    const press = S.edit ? 0 : window.setTimeout(() => ((held.current = true), update((x) => (x.edit = true))), 450);

    const centre = () => {
      const r = viewportRect(el);
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const iconAt = (x: number, y: number) => document.elementsFromPoint(x, y).map((n) => n.closest<HTMLElement>('[data-icon]')).find((n) => n && n !== el);

    const step = () => {
      frame = 0;
      const m = last;
      if (!m) return;
      const far = Math.hypot(m.clientX - sx, m.clientY - sy) > 6;
      // Moving before the hold has registered is a swipe between pages, not a drag.
      if (!S.edit) return void (far && stop());
      if (!drag) {
        if (!far) return;
        const c = centre();
        drag = { gx: m.clientX - c.x, gy: m.clientY - c.y, tx: 0, ty: 0 };
        held.current = true;
        el.classList.add('lifted');
        // If it was still sliding into place from an earlier move, that slide would fight the drag.
        el.getAnimations().forEach((anim) => anim.cancel());
      }
      // Work from where the icon's slot is right now, so it stays under the pointer when the others move around it.
      const k = view.k;
      const c = centre();
      drag.tx = (m.clientX - drag.gx - (c.x - drag.tx * k)) / k;
      drag.ty = (m.clientY - drag.gy - (c.y - drag.ty * k)) / k;
      el.style.transform = `translate(${drag.tx}px, ${drag.ty}px) scale(1.12)`;

      // Resting over a neighbour for a moment makes it give way. (Across to the dock or another page happens on release.)
      const target = iconAt(m.clientX, m.clientY);
      const id2 = target && target.parentElement === el.parentElement ? (target.dataset.icon ?? null) : null;
      if (id2 === over) return;
      over = id2;
      window.clearTimeout(dwell);
      if (id2) dwell = window.setTimeout(() => ((over = null), shift(el.parentElement!, () => moveApp(id, id2)), last && step()), 140);
    };
    const move = (m: PointerEvent) => {
      last = m;
      frame ||= requestAnimationFrame(step);
    };
    function stop() {
      window.clearTimeout(press);
      window.clearTimeout(dwell);
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    }
    function up(u: PointerEvent) {
      stop();
      if (!drag) return;
      const from = el.style.transform;
      el.classList.remove('lifted');
      el.style.transform = '';
      const target = iconAt(u.clientX, u.clientY);
      if (target?.dataset.icon) return shift(target.parentElement!, () => moveApp(id, target.dataset.icon!));
      // Settle into its place rather than snapping there.
      el.animate([{ transform: from }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (held.current) return void (held.current = false);
    if (!S.edit) openApp(id, e.currentTarget.querySelector('.app-ic'));
  };

  return (
    <button className="hicon" data-icon={id} data-nodrag={s.edit ? '' : undefined} onPointerDown={onDown} onClick={onClick} aria-label={count ? t('sys_name_count_new', { name: def.name, count }) : def.name}>
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
        <span className="hicon-name">{t('sys_weather')}</span>
      </button>
      )}
      {has('clock') && (
      <button className="widget" onClick={(e) => !S.edit && openApp('clock', e.currentTarget.firstElementChild)}>
        <span className="widget-box w-clock">
          <ClockFace size={138} numbers />
        </span>
        <span className="hicon-name">{t('sys_clock')}</span>
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
    <div className="spot" role="dialog" aria-label={t('search')}>
      <div className="spot-bar">
        <Search value={q} onChange={setQ} autoFocus />
        <button onClick={() => update((x) => (x.search = false))}>{t('cancel')}</button>
      </div>
      {ids.length > 0 && <h3>{term ? t('sys_applications') : t('sys_suggestions')}</h3>}
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
          <h3>{t('contacts')}</h3>
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
      {term && !ids.length && !people.length && <p className="spot-none">{t('sys_no_results_for_q', { q })}</p>}
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
            <button key={i} aria-label={t('sys_page_x', { x: i + 1 })} aria-current={i === page ? 'page' : undefined} onClick={() => goTo(i)} />
          ))}
        </div>
      ) : (
        <button className="home-pill" onClick={() => update((x) => (x.search = true))}>
          <SearchIcon size={11} strokeWidth={3} />{' '}{t('search')}
        </button>
      )}
      <div className="dock">
        {s.dock.map((id) => (
          <HomeIcon key={id} id={id} dock />
        ))}
      </div>
      {s.edit && (
        <button className="home-done" onClick={() => update((x) => (x.edit = false))}>
          {t('done')}
        </button>
      )}
      {s.search && <Spotlight />}
    </div>
  );
}
