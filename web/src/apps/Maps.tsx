import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { LocateFixed, MapPin, Minus, Navigation, Plus, Share, X } from 'lucide-react';
import { places } from '../data';
import { notify, share, view } from '../store';
import { Search } from '../ui';

const ME = { x: 50, y: 66 };
const SIZE = 900;

/* ponytail: an invented map so the demo ships no game assets. In-game, swap the <svg> for map tiles
 * and feed `places` / ME from blips and the player's coords. */
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
  const [pos, setPos] = useState({ x: -ME.x * 9 + 196, y: -ME.y * 9 + 340 });
  const [zoom, setZoom] = useState(1);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<number | null>(null);
  const [route, setRoute] = useState<number | null>(null);
  const moved = useRef(false);
  const place = places.find((p) => p.id === sel);
  const dest = places.find((p) => p.id === route);
  const list = places.filter((p) => `${p.name} ${p.kind}`.toLowerCase().includes(q.toLowerCase()));

  const center = (x: number, y: number) => setPos({ x: -x * 9 * zoom + 196, y: -y * 9 * zoom + 300 });
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
        <div className="maps-canvas" style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})` }}>
          <MapArt />
          {dest && (
            <svg viewBox="0 0 100 100" width={SIZE} height={SIZE} className="m-route" aria-hidden="true">
              <path d={`M${ME.x} ${ME.y} Q${(ME.x + dest.x) / 2 + 6} ${(ME.y + dest.y) / 2 - 4} ${dest.x} ${dest.y}`} />
            </svg>
          )}
          {places.map((p) => (
            <button key={p.id} className={`m-pin ${p.id === sel ? 'on' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} aria-label={p.name} onClick={() => !moved.current && pick(p.id)}>
              <MapPin size={30} fill="currentColor" stroke="#fff" strokeWidth={1.5} />
              <span>{p.name}</span>
            </button>
          ))}
          <i className="m-me" style={{ left: `${ME.x}%`, top: `${ME.y}%` }} aria-label="Your location" />
        </div>
      </div>

      <div className="maps-ctl">
        <button aria-label="My location" onClick={() => center(ME.x, ME.y)}>
          <LocateFixed size={20} />
        </button>
        <button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2.4, z + 0.3))}>
          <Plus size={20} />
        </button>
        <button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, z - 0.3))}>
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
                  {place.kind} · {(Math.hypot(place.x - ME.x, place.y - ME.y) * 0.21).toFixed(1)} km away
                </p>
              </div>
              <button aria-label="Close" className="maps-x" onClick={() => setSel(null)}>
                <X size={16} strokeWidth={3} />
              </button>
            </header>
            <div className="maps-acts">
              <button
                className="primary"
                onClick={() => {
                  setRoute(route === place.id ? null : place.id);
                  if (route !== place.id) notify({ app: 'maps', title: 'Waypoint set', body: `Route to ${place.name} is on your GPS.` });
                }}
              >
                <Navigation size={18} fill="currentColor" />
                {route === place.id ? 'Remove Waypoint' : 'Set Waypoint'}
              </button>
              <button onClick={() => share({ kind: 'Location', label: place.name })}>
                <Share size={18} />
                Share
              </button>
            </div>
          </>
        ) : (
          <>
            <Search value={q} onChange={setQ} placeholder="Search Maps" />
            <div className="maps-list">
              <button onClick={() => share({ kind: 'Location', label: 'My Location · Legion Square' })}>
                <span className="maps-dot blue">
                  <LocateFixed size={16} />
                </span>
                <span>
                  <b>Share My Location</b>
                  <small>Legion Square</small>
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
