import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { LocateFixed, MapPin, Minus, Navigation, Plus, Share, X } from 'lucide-react';
import { places } from '../data';
import { inGame, rpc } from '../net';
import { mapPercent } from '../nui';
import { notify, share, update, useS, view } from '../store';
import { Search } from '../ui';
import { t } from '../i18n';

const DEMO = { x: 50, y: 66 };
const SIZE = 900;

/* An invented map, so the phone ships no game assets. Servers point Config.map.image at a real one. */
function MapArt() {
  return (
    <svg viewBox="0 0 100 100" width={SIZE} height={SIZE} aria-hidden="true">
      <rect width="100" height="100" className="m-sea" />
      <path className="m-land" d="M38 6c9-4 22-2 30 6 7 7 6 18 10 27 4 10 12 17 10 29-2 11-13 14-22 20-8 5-17 9-27 6-11-3-17-13-22-23-5-9-9-19-6-30 3-12 9-20 15-27 4-4 8-6 14-8Z" />
      <path className="m-park" d="M52 12c7-1 14 2 17 8 2 5-2 10-8 11-7 1-15-1-17-7-2-6 2-11 8-12ZM22 44c4-2 9 0 10 4s-2 8-6 9-8-2-8-6 1-5 4-7ZM70 74c4-1 8 1 8 5s-4 6-8 6-6-3-5-6 2-4 5-5Z" />
      <path className="m-water" d="M44 36c4-1 8 1 8 4s-4 5-8 4-5-3-4-5 2-2 4-3Z" />
      <g className="m-block">
        {Array.from({ length: 30 }, (_, i) => (
          <rect key={i} x={42 + (i % 6) * 4.2} y={54 + Math.floor(i / 6) * 4.2} width="3.2" height="3.2" rx=".5" />
        ))}
      </g>
      <g className="m-road">
        <path d="M14 58C30 54 44 52 58 54s22 8 30 12" />
        <path d="M50 8c-2 16 2 30 0 46s-8 26-14 38" />
        <path d="M24 30c12 4 26 6 40 4s18-2 24 2" />
        <path d="M34 88c10-6 22-8 32-6s14 2 20-4" />
        <path d="M62 22c4 10 6 22 4 34s-2 20 2 28" />
      </g>
      <g className="m-hwy">
        <path d="M18 60C30 70 46 76 62 74s20-8 26-14" />
      </g>
    </svg>
  );
}

export function MapsApp() {
  const s = useS();
  // The map picture's height over its width: the canvas takes the picture's shape, so pins stay true.
  const [ratio, setRatio] = useState(1);
  const ME = s.position ? mapPercent(s.position.x, s.position.y) : DEMO;
  const [pos, setPos] = useState({ x: -ME.x * 9 + 196, y: -ME.y * 9 + 340 });
  const [zoom, setZoom] = useState(1);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<number | null>(null);
  const [route, setRoute] = useState<number | null>(null);
  const moved = useRef(false);
  const place = places.find((p) => p.id === sel);
  const dest = places.find((p) => p.id === route);
  const list = places.filter((p) => `${p.name} ${p.kind}`.toLowerCase().includes(q.toLowerCase()));

  const center = (x: number, y: number) => setPos({ x: -x * 9 * zoom + 196, y: -y * 9 * ratio * zoom + 300 });

  // In-game: where the player really is, re-read while the app is open.
  useEffect(() => {
    if (!inGame) return;
    const read = async () => {
      const r = await rpc<{ x: number; y: number; street: string }>('position');
      if (r?.ok) update((st) => (st.position = { x: r.x, y: r.y, street: r.street }));
    };
    read();
    const timer = window.setInterval(read, 2000);
    return () => window.clearInterval(timer);
  }, []);
  // Start on the player once the first position (and the map's shape) is known.
  const found = !!s.position;
  useEffect(() => {
    if (found) center(ME.x, ME.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, not on every step the player takes
  }, [found, ratio]);

  /** Distance to a place in km: real in-game, a rough guess on the demo map. */
  const km = (p: { x: number; y: number; wx?: number; wy?: number }) =>
    (s.position && p.wx != null && p.wy != null ? Math.hypot(p.wx - s.position.x, p.wy - s.position.y) / 1000 : Math.hypot(p.x - ME.x, p.y - ME.y) * 0.21).toFixed(1);
  const here = s.position?.street || t('maps_legion_square');
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    const k = view.k;
    const start = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    moved.current = false;
    const move = (m: PointerEvent) => {
      moved.current = true;
      setPos({ x: start.px + (m.clientX - start.x) / k, y: start.py + (m.clientY - start.y) / k });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true });
  };
  const pick = (id: number) => {
    const p = places.find((x) => x.id === id)!;
    setSel(id);
    setQ('');
    center(p.x, p.y);
  };

  return (
    <div className="maps">
      <div className="maps-view" onPointerDown={onDown} onWheel={(e) => setZoom((z) => Math.min(2.4, Math.max(0.6, z - Math.sign(e.deltaY) * 0.2)))}>
        <div className="maps-canvas" style={{ height: SIZE * ratio, transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})` }}>
          {s.cfg.map.image ? <img src={s.cfg.map.image} alt="" draggable={false} onLoad={(e) => setRatio(e.currentTarget.naturalHeight / e.currentTarget.naturalWidth || 1)} /> : <MapArt />}
          {dest && (
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" width={SIZE} height={SIZE * ratio} className="m-route" aria-hidden="true">
              <path d={`M${ME.x} ${ME.y} Q${(ME.x + dest.x) / 2 + 6} ${(ME.y + dest.y) / 2 - 4} ${dest.x} ${dest.y}`} />
            </svg>
          )}
          {places.map((p) => (
            <button key={p.id} className={`m-pin ${p.id === sel ? 'on' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} aria-label={p.name} onClick={() => !moved.current && pick(p.id)}>
              <MapPin size={30} fill="currentColor" stroke="#fff" strokeWidth={1.5} />
              <span>{p.name}</span>
            </button>
          ))}
          <i className="m-me" style={{ left: `${ME.x}%`, top: `${ME.y}%` }} aria-label={t('maps_your_location')} />
        </div>
      </div>

      <div className="maps-ctl">
        <button aria-label={t('maps_my_location')} onClick={() => center(ME.x, ME.y)}>
          <LocateFixed size={20} />
        </button>
        <button aria-label={t('maps_zoom_in')} onClick={() => setZoom((z) => Math.min(2.4, z + 0.3))}>
          <Plus size={20} />
        </button>
        <button aria-label={t('maps_zoom_out')} onClick={() => setZoom((z) => Math.max(0.6, z - 0.3))}>
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
                  rpc('waypoint', route === place.id ? { clear: true } : { x: place.wx, y: place.wy });
                  if (route !== place.id) notify({ app: 'maps', title: t('waypoint_set'), body: t('route_to_name_is_on_your', { name: place.name }) });
                }}
              >
                <Navigation size={18} fill="currentColor" />
                {route === place.id ? t('maps_remove_waypoint') : t('set_waypoint')}
              </button>
              <button onClick={() => share({ kind: t('kind_location'), label: place.name, item: { kind: 'location', label: place.name, x: place.wx, y: place.wy } })}>
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
