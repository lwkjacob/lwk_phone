import { S } from './store';

/* The map is a pyramid of 1024px tiles (tiles/ at the resource root): one for the whole map at level 0, 8 x 8 at
 * level 3. Few and big on purpose: the server goes through every file each time the resource starts, and 2,700
 * small tiles froze it for ten seconds. Positions are in "map units": the map is 256 of them across, and
 * 256 * 2^zoom px on screen, so level `zoom - 2` is drawn 1:1. */
export const WORLD = 256;
const MAX_LEVEL = 3;

/** Game coordinates to map units. Measured from the tile set's own coordinate grid: 0.66px per game unit at level 5, origin at (3755.5, 5524.5). */
export const project = (x: number, y: number) => ({ x: 117.36 + x * 0.020625, y: 172.64 - y * 0.020625 });
export const inMap = (n: number) => Math.min(WORLD, Math.max(0, n));

/** The satellite view is showing (a dark picture, where the road map is a light one). */
export const satellite = () => S.settings.satellite && !S.cfg.map.image;

/** The level at least as detailed as the zoom, so tiles are only ever stretched past MAX_LEVEL. */
export const levelFor = (z: number) => Math.min(MAX_LEVEL, Math.max(0, Math.ceil(z - 2)));

/** A window onto the map, in px: its size, the point in it where the map position sits, and how far past its edges tiles are still drawn. */
export type MapWindow = { w: number; h: number; fx: number; fy: number; margin?: number };

/** The tiles of `level` under a window when the map unit (x, y) is at its (fx, fy), each with its box on the canvas in px. */
export function tilesAt(v: { x: number; y: number; z: number }, win: MapWindow, level = levelFor(v.z), sat = satellite()) {
  const scale = 2 ** v.z;
  const ox = win.fx - v.x * scale;
  const oy = win.fy - v.y * scale;
  const margin = win.margin ?? 0;
  const size = (WORLD * scale) / 2 ** level;
  const last = 2 ** level - 1;
  const tiles: { src: string; left: number; top: number; width: number; height: number }[] = [];
  for (let x = Math.max(0, Math.floor((-ox - margin) / size)); x <= Math.min(last, Math.floor((win.w - ox + margin) / size)); x++)
    for (let y = Math.max(0, Math.floor((-oy - margin) / size)); y <= Math.min(last, Math.floor((win.h - oy + margin) / size)); y++) {
      // Whole pixels, or hairlines show between tiles.
      const left = Math.round(x * size);
      const top = Math.round(y * size);
      tiles.push({ src: `../../tiles/${sat ? 'satellite' : 'atlas'}/${level}/${x}-${y}.webp`, left, top, width: Math.round((x + 1) * size) - left, height: Math.round((y + 1) * size) - top });
    }
  return tiles;
}

/** A still picture of the map around a place in game coordinates: the satellite view, with the place in the middle. */
export function MapSnippet({ x, y, w, h, zoom = 4 }: { x: number; y: number; w: number; h: number; zoom?: number }) {
  const at = project(x, y);
  const scale = 2 ** zoom;
  return (
    <span className="map-snip" style={{ width: w, height: h }} aria-hidden="true">
      <span style={{ transform: `translate(${w / 2 - at.x * scale}px, ${h / 2 - at.y * scale}px)` }}>
        {tilesAt({ ...at, z: zoom }, { w, h, fx: w / 2, fy: h / 2 }, undefined, true).map(({ src, ...box }) => (
          <img key={src} src={src} alt="" draggable={false} style={box} />
        ))}
      </span>
    </span>
  );
}
