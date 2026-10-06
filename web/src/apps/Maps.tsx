import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type WheelEvent } from 'react';
import { Layers, LocateFixed, MapPin, Minus, Navigation, Plus, Share, X } from 'lucide-react';
import { places } from '../data';
import { inGame, rpc } from '../net';
import { S, notify, share, update, useS, view, viewportRect } from '../store';
import { Search } from '../ui';
import { t } from '../i18n';

/* The map is a pyramid of 1024px tiles (tiles/ at the resource root): one for the whole map at level 0, 8 x 8 at
 * level 3. Few and big on purpose: the server goes through every file each time the resource starts, and 2,700
 * small tiles froze it for ten seconds. Positions are in "map units": the map is 256 of them across, and
 * 256 * 2^zoom px on screen, so level `zoom - 2` is drawn 1:1. */
const WORLD = 256;
const MAX_LEVEL = 3;
const MIN_ZOOM = 1;
// One step past the deepest tiles: they are stretched 2x there, which is soft but still readable.
const MAX_ZOOM = 6;
// Tiles are also drawn this far (px) outside the screen, so a drag has somewhere to go before React draws again,
// and React is only told about a drag once it has moved this far.
const MARGIN = 160;
const COMMIT = 120;
// The screen in layout px, and the point on it that counts as the middle (the card covers the bottom).
const VIEW = { w: 393, h: 852 };
const FOCUS = { x: 196, y: 300 };
const START_ZOOM = 4;
// Where the browser demo stands: Legion Square.
const DEMO = { x: 195, y: -934 };

/** Game coordinates to map units. Measured from the tile set's own coordinate grid: 0.66px per game unit at level 5, origin at (3755.5, 5524.5). */
const project = (x: number, y: number) => ({ x: 117.36 + x * 0.020625, y: 172.64 - y * 0.020625 });
const inMap = (n: number) => Math.min(WORLD, Math.max(0, n));

/** The satellite view is showing (a dark picture, where the road map is a light one). */
export const satellite = () => S.settings.satellite && !S.cfg.map.image;
const tileUrl = (level: number, x: number, y: number) => `../../tiles/${satellite() ? 'satellite' : 'atlas'}/${level}/${x}-${y}.webp`;

/** The level at least as detailed as the zoom, so tiles are only ever stretched past MAX_LEVEL. */
const levelFor = (z: number) => Math.min(MAX_LEVEL, Math.max(0, Math.ceil(z - 2)));

/** The tiles of `level` under the screen (and MARGIN around it) when the map unit (x, y) is at FOCUS, each with its box on the canvas in px. */
function tilesAt(v: { x: number; y: number; z: number }, level = levelFor(v.z)) {
  const scale = 2 ** v.z;
  const ox = FOCUS.x - v.x * scale;
  const oy = FOCUS.y - v.y * scale;
  const size = (WORLD * scale) / 2 ** level;
  const last = 2 ** level - 1;
  const tiles: { src: string; left: number; top: number; width: number; height: number }[] = [];
  for (let x = Math.max(0, Math.floor((-ox - MARGIN) / size)); x <= Math.min(last, Math.floor((VIEW.w - ox + MARGIN) / size)); x++)
    for (let y = Math.max(0, Math.floor((-oy - MARGIN) / size)); y <= Math.min(last, Math.floor((VIEW.h - oy + MARGIN) / size)); y++) {
      // Whole pixels, or hairlines show between tiles.
      const left = Math.round(x * size);
      const top = Math.round(y * size);
      tiles.push({ src: tileUrl(level, x, y), left, top, width: Math.round((x + 1) * size) - left, height: Math.round((y + 1) * size) - top });
    }
  return tiles;
}

async function locate() {
  const r = await rpc<{ x: number; y: number; street: string }>('position');
  const p = S.position;
  // Standing still changes nothing, and an update redraws the whole phone.
  if (r?.ok && (r.x !== p?.x || r.y !== p?.y || r.street !== p?.street)) update((st) => (st.position = { x: r.x, y: r.y, street: r.street }));
}

// Held on to, so the browser keeps what it fetched.
let warm: HTMLImageElement[] = [];

/**
 * Get Maps ready before it is opened: find the player and fetch the tiles it will start on. Without this the
 * first open draws the wrong place, learns the position, then loads a second screenful while the app animates in.
 */
export async function warmMap() {
  await locate();
  if (S.cfg.map.image) return;
  const me = S.position ?? DEMO;
  warm = tilesAt({ ...project(me.x, me.y), z: START_ZOOM }).map((x) => Object.assign(new Image(), { src: x.src }));
}

export function MapsApp() {
  const s = useS();
  const me = s.position ?? DEMO;
  // The map unit under FOCUS, and the zoom: the map is 256 * 2^z px across.
  const [v, setV] = useState(() => ({ ...project(me.x, me.y), z: START_ZOOM }));
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<number | null>(null);
  const [route, setRoute] = useState<number | null>(null);
  const moved = useRef(false);
  const canvas = useRef<HTMLDivElement>(null);
  const place = places.find((p) => p.id === sel);
  const dest = places.find((p) => p.id === route);
  const list = places.filter((p) => `${p.name} ${p.kind}`.toLowerCase().includes(q.toLowerCase()));

  const scale = 2 ** v.z;
  const ox = FOCUS.x - v.x * scale;
  const oy = FOCUS.y - v.y * scale;
  /** A point in game coordinates, in px on the canvas. */
  const at = (x: number, y: number) => {
    const p = project(x, y);
    return { left: p.x * scale, top: p.y * scale };
  };
  const center = (p: { x: number; y: number }) => setV((o) => ({ ...o, ...project(p.x, p.y) }));

  const custom = s.cfg.map.image;
  const level = levelFor(v.z);
  // The last level whose tiles all arrived. It stays underneath until the current one has too, so zooming never shows a hole.
  const [ready, setReady] = useState(level);
  const arrived = () => [...canvas.current!.querySelectorAll<HTMLImageElement>('img.top')].every((i) => i.complete) && setReady(level);
  // (Two or more levels deeper than the current one would be dozens of tiles: not worth it.)
  const under = ready !== level && ready <= level + 1 ? tilesAt(v, ready) : [];
  // A server's own map: one picture, placed by the game coordinates of its edges.
  const b = s.cfg.map.bounds;
  const nw = at(b.minX, b.maxY);
  const se = at(b.maxX, b.minY);

  // In-game: where the player really is, re-read while the app is open.
  useEffect(() => {
    if (!inGame) return;
    locate();
    const timer = window.setInterval(locate, 2000);
    return () => window.clearInterval(timer);
  }, []);
  // Start on the player once the first position is known.
  const found = !!s.position;
  useEffect(() => {
    if (found) center(me);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, not on every step the player takes
  }, [found]);

  const km = (p: { x: number; y: number }) => (Math.hypot(p.x - me.x, p.y - me.y) / 1000).toFixed(1);
  const here = s.position?.street || t('maps_legion_square');
  /* Dragging moves the canvas itself, once a frame, and leaves React out of it: redrawing the app on every
   * mouse event is what made the map stutter. React hears about it when the drag has used up the margin of
   * tiles around the screen, and when it ends. */
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    const sx = e.clientX;
    const sy = e.clientY;
    const from = { x: v.x, y: v.y };
    let cur = from;
    let drawn = from;
    let frame = 0;
    moved.current = false;
    const commit = () => {
      const c = (drawn = cur);
      setV((o) => ({ ...o, ...c }));
    };
    const paint = () => {
      frame = 0;
      if (canvas.current) canvas.current.style.transform = `translate(${FOCUS.x - cur.x * scale}px, ${FOCUS.y - cur.y * scale}px)`;
      if (Math.max(Math.abs(cur.x - drawn.x), Math.abs(cur.y - drawn.y)) * scale > COMMIT) commit();
    };
    const move = (m: PointerEvent) => {
      // The phone is zoomed, so pointer pixels are not layout pixels.
      const dx = (m.clientX - sx) / view.k;
      const dy = (m.clientY - sy) / view.k;
      // A click wobbles by a pixel or two; that is not a drag.
      if (!moved.current && Math.hypot(dx, dy) < 4) return;
      moved.current = true;
      cur = { x: inMap(from.x - dx / scale), y: inMap(from.y - dy / scale) };
      frame ||= requestAnimationFrame(paint);
    };
    const up = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      if (moved.current) commit();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };
  /** Zoom by `d` levels, keeping the map under the screen point (px, py) where it is. */
  const zoomBy = (d: number, px = FOCUS.x, py = FOCUS.y) =>
    setV((o) => {
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, o.z + d));
      const dx = px - FOCUS.x;
      const dy = py - FOCUS.y;
      return { x: inMap(o.x + dx / 2 ** o.z - dx / 2 ** z), y: inMap(o.y + dy / 2 ** o.z - dy / 2 ** z), z };
    });
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    const r = viewportRect(e.currentTarget);
    zoomBy(-Math.sign(e.deltaY) * 0.5, (e.clientX - r.left) / view.k, (e.clientY - r.top) / view.k);
  };
  const pick = (id: number) => {
    setSel(id);
    setQ('');
    center(places.find((x) => x.id === id)!);
  };
  // ponytail: a curve, not the roads. The real route needs the road network as data and path-finding here.
  const curve = (to: { x: number; y: number }) => {
    const a = at(me.x, me.y);
    const z = at(to.x, to.y);
    return `M${a.left + ox} ${a.top + oy} Q${(a.left + z.left) / 2 + ox + 24} ${(a.top + z.top) / 2 + oy - 16} ${z.left + ox} ${z.top + oy}`;
  };

  return (
    <div className={`maps ${satellite() ? 'sat' : ''}`}>
      <div className="maps-view" onPointerDown={onDown} onWheel={onWheel}>
        <div className="maps-canvas" ref={canvas} style={{ transform: `translate(${ox}px, ${oy}px)` }}>
          {custom ? (
            <img src={custom} alt="" draggable={false} style={{ ...nw, width: se.left - nw.left, height: se.top - nw.top }} />
          ) : (
            <>
              {under.map(({ src, ...box }) => (
                <img key={src} src={src} alt="" draggable={false} style={box} />
              ))}
              {tilesAt(v).map(({ src, ...box }) => (
                <img key={src} className="top" src={src} alt="" draggable={false} style={box} onLoad={arrived} onError={arrived} />
              ))}
            </>
          )}
          {dest && (
            <svg className="m-route" width={VIEW.w} height={VIEW.h} style={{ left: -ox, top: -oy }} aria-hidden="true">
              <path d={curve(dest)} />
            </svg>
          )}
          {places.map((p) => (
            <button key={p.id} className={`m-pin ${p.id === sel ? 'on' : ''}`} style={at(p.x, p.y)} aria-label={p.name} onClick={() => !moved.current && pick(p.id)}>
              <MapPin size={30} fill="currentColor" stroke="#fff" strokeWidth={1.5} />
              <span>{p.name}</span>
            </button>
          ))}
          <i className="m-me" style={at(me.x, me.y)} aria-label={t('maps_your_location')} />
        </div>
      </div>

      <div className="maps-ctl">
        <button aria-label={t('maps_my_location')} onClick={() => center(me)}>
          <LocateFixed size={20} />
        </button>
        {!custom && (
          <button aria-label={t(s.settings.satellite ? 'maps_road_map' : 'maps_satellite')} onClick={() => update((x) => (x.settings.satellite = !x.settings.satellite))}>
            <Layers size={20} />
          </button>
        )}
        <button aria-label={t('maps_zoom_in')} onClick={() => zoomBy(1)}>
          <Plus size={20} />
        </button>
        <button aria-label={t('maps_zoom_out')} onClick={() => zoomBy(-1)}>
          <Minus size={20} />
        </button>
      </div>

      <div className={`maps-card ${place || q ? 'tall' : ''}`}>
        {place ? (
          <>
            <header>
              <div>
                <h1>{place.name}</h1>
                <p>
                  {place.kind}{' '}{t('maps_n_km_away', { n: km(place) })}
                </p>
              </div>
              <button aria-label={t('close')} className="maps-x" onClick={() => setSel(null)}>
                <X size={16} strokeWidth={3} />
              </button>
            </header>
            <div className="maps-acts">
              <button
                className="primary"
                onClick={() => {
                  setRoute(route === place.id ? null : place.id);
                  rpc('waypoint', route === place.id ? { clear: true } : { x: place.x, y: place.y });
                  if (route !== place.id) notify({ app: 'maps', title: t('waypoint_set'), body: t('route_to_name_is_on_your', { name: place.name }) });
                }}
              >
                <Navigation size={18} fill="currentColor" />
                {route === place.id ? t('maps_remove_waypoint') : t('set_waypoint')}
              </button>
              <button onClick={() => share({ kind: t('kind_location'), label: place.name, item: { kind: 'location', label: place.name, x: place.x, y: place.y } })}>
                <Share size={18} />
                {t('share')}
              </button>
            </div>
          </>
        ) : (
          <>
            <Search value={q} onChange={setQ} placeholder={t('maps_search_maps')} />
            <div className="maps-list">
              <button onClick={() => share({ kind: t('kind_location'), label: s.position ? here : t('maps_my_location_legion_square'), item: { kind: 'location', label: here, x: s.position?.x, y: s.position?.y } })}>
                <span className="maps-dot blue">
                  <LocateFixed size={16} />
                </span>
                <span>
                  <b>{t('share_my_location')}</b>
                  <small>{here}</small>
                </span>
              </button>
              {list.map((p) => (
                <button key={p.id} onClick={() => pick(p.id)}>
                  <span className="maps-dot">
                    <MapPin size={16} fill="currentColor" />
                  </span>
                  <span>
                    <b>{p.name}</b>
                    <small>{p.kind}</small>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
