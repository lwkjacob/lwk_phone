import { useEffect, useState } from 'react';
import { Heart, Image as ImageIcon, Play, Share, SwitchCamera, Trash2, Video, Zap, ZapOff } from 'lucide-react';
import type { Photo } from '../data';
import { sfx } from '../sound';
import { S, addPhoto, confirm, fmtDur, fmtTime, openApp, share, update, useNow, useS } from '../store';
import { Empty, Page, Pic, Seg, Sheet, Tabs, useNav } from '../ui';

/* ---------- Photos ---------- */

const ALBUMS = [
  { id: 'recents', name: 'Recents', test: (_: Photo) => true },
  { id: 'favorites', name: 'Favorites', test: (p: Photo) => !!p.fav },
  { id: 'videos', name: 'Videos', test: (p: Photo) => !!p.video },
  { id: 'selfies', name: 'Selfies', test: (p: Photo) => !!p.selfie },
];

function Thumb({ p, onClick }: { p: Photo; onClick: () => void }) {
  return (
    <Pic seed={p.seed} className="ugc" alt={p.video ? 'Video' : 'Photo'} onClick={onClick}>
      {p.fav && <Heart size={13} fill="#fff" strokeWidth={0} className="thumb-fav" />}
      {p.video && <span className="thumb-dur">{fmtDur(p.video)}</span>}
    </Pic>
  );
}

function Viewer({ id, album }: { id: number; album: string }) {
  const s = useS();
  const nav = useNav();
  const [cur, setCur] = useState(id);
  const [playing, setPlaying] = useState(false);
  const list = s.photos.filter(ALBUMS.find((a) => a.id === album)!.test);
  const p = list.find((x) => x.id === cur) ?? list[0];
  useEffect(() => {
    if (!p) nav.pop();
  }, [p, nav]);
  if (!p) return null;
  const d = new Date(p.time);
  return (
    <Page
      className="viewer"
      title={
        <span className="viewer-title">
          {d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
          <small>{fmtTime(p.time, true)}</small>
        </span>
      }
      footer={
        <div className="viewer-foot">
          <div className="viewer-strip">
            {list.map((x) => (
              <Pic key={x.id} seed={x.seed} className={`ugc ${x.id === p.id ? 'on' : ''}`} onClick={() => (setCur(x.id), setPlaying(false))} />
            ))}
          </div>
          <div className="toolbar">
            <button aria-label="Share" onClick={() => share({ kind: p.video ? 'Video' : 'Photo', label: p.video ? 'Video' : 'Photo', seed: p.seed })}>
              <Share size={24} />
            </button>
            <button aria-label="Favorite" aria-pressed={!!p.fav} onClick={() => update(() => (p.fav = !p.fav))}>
              <Heart size={24} fill={p.fav ? 'currentColor' : 'none'} />
            </button>
            <button aria-label="Delete" onClick={() => confirm(p.video ? 'Delete Video' : 'Delete Photo', 'This item will be deleted from your library.', 'Delete', () => update((x) => (x.photos = x.photos.filter((y) => y !== p))))}>
              <Trash2 size={24} />
            </button>
          </div>
        </div>
      }
    >
      <Pic seed={p.seed} className={`viewer-pic ugc ${playing ? 'pan' : ''}`} alt={p.video ? 'Video' : 'Photo'}>
        {p.video && !playing && (
          <button className="viewer-play" aria-label="Play video" onClick={() => setPlaying(true)}>
            <Play size={30} fill="currentColor" strokeWidth={0} />
          </button>
        )}
      </Pic>
    </Page>
  );
}

function Grid({ album }: { album: string }) {
  const s = useS();
  const nav = useNav();
  const list = s.photos.filter(ALBUMS.find((a) => a.id === album)!.test);
  if (!list.length) return <Empty icon={<ImageIcon size={44} />} title="No Photos or Videos" text="Take photos with Camera and they appear here." />;
  return (
    <>
      <div className="pgrid">
        {list.map((p) => (
          <Thumb key={p.id} p={p} onClick={() => nav.push(<Viewer id={p.id} album={album} />)} />
        ))}
      </div>
      <p className="pgrid-count">
        {list.filter((p) => !p.video).length} Photos, {list.filter((p) => p.video).length} Videos
      </p>
    </>
  );
}

function Albums() {
  const s = useS();
  const nav = useNav();
  return (
    <Page title="Albums" large>
      <div className="albums">
        {ALBUMS.map((a) => {
          const list = s.photos.filter(a.test);
          return (
            <button
              key={a.id}
              onClick={() =>
                nav.push(
                  <Page title={a.name} back="Albums">
                    <Grid album={a.id} />
                  </Page>,
                )
              }
            >
              {list[0] ? <Pic seed={list[0].seed} className="ugc" /> : <span className="pic none" />}
              <b>{a.name}</b>
              <small>{list.length}</small>
            </button>
          );
        })}
      </div>
    </Page>
  );
}

export function PhotosApp() {
  return (
    <Tabs
      tabs={[
        {
          id: 'library',
          label: 'Library',
          icon: <ImageIcon size={24} fill="currentColor" stroke="var(--bar-solid)" />,
          view: (
            <Page title="Library" large>
              <Grid album="recents" />
            </Page>
          ),
        },
        { id: 'albums', label: 'Albums', icon: <ImageIcon size={24} />, view: <Albums /> },
      ]}
    />
  );
}

/** Sheet for attaching a photo from the library (Messages, social apps, listings). */
export function PhotoPicker({ onPick, onClose, videos }: { onPick: (seed: number) => void; onClose: () => void; videos?: boolean }) {
  const list = S.photos.filter((p) => (videos ? p.video : !p.video));
  return (
    <Sheet title={videos ? 'Videos' : 'Photos'} onClose={onClose}>
      {(close) =>
        list.length ? (
          <div className="pgrid">
            {list.map((p) => (
              <Thumb key={p.id} p={p} onClick={() => (onPick(p.seed), close())} />
            ))}
          </div>
        ) : (
          <Empty icon={<ImageIcon size={44} />} title={videos ? 'No Videos' : 'No Photos'} text="Capture something with Camera first." />
        )
      }
    </Sheet>
  );
}

/* ---------- Camera ---------- */

export function CameraApp() {
  const s = useS();
  const now = useNow(500);
  const [mode, setMode] = useState<'video' | 'photo'>('photo');
  const [selfie, setSelfie] = useState(false);
  const [flash, setFlash] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rec, setRec] = useState<number | null>(null);
  const [snap, setSnap] = useState(0);
  // In-game the viewfinder is the game camera; here it is a generated scene.
  const seed = selfie ? 21 : 88;
  const last = s.photos[0];

  const shutter = () => {
    if (mode === 'photo') {
      sfx('shutter');
      setSnap((n) => n + 1);
      addPhoto({ seed: seed + Math.floor(Math.random() * 40), selfie });
    } else if (rec == null) setRec(Date.now());
    else {
      addPhoto({ seed, selfie, video: Math.max(1, Math.round((Date.now() - rec) / 1000)) });
      setRec(null);
    }
  };

  return (
    <div className="cam">
      <div className="cam-top">
        <button aria-label="Flash" aria-pressed={flash} onClick={() => (setFlash(!flash), update((x) => (x.flashlight = !flash)))}>
          {flash ? <Zap size={18} fill="currentColor" /> : <ZapOff size={18} />}
        </button>
        {rec != null && <span className="cam-timer">{fmtDur((now - rec) / 1000)}</span>}
        <span />
      </div>
      <div className="cam-view">
        <Pic seed={seed} className="cam-scene" alt="Viewfinder" style={{ transform: `scale(${zoom})` }} />
        {snap > 0 && <i key={snap} className="cam-flash" />}
        <div className="cam-zoom">
          {([['.5', 1], ['1', 1.5], ['2', 2.4]] as const).map(([label, scale]) => (
            <button key={label} aria-pressed={zoom === scale} onClick={() => setZoom(scale)}>
              {label}
              {zoom === scale && '×'}
            </button>
          ))}
        </div>
      </div>
      <div className="cam-modes">
        <Seg value={mode} onChange={(m) => rec == null && setMode(m)} options={[['video', 'VIDEO'], ['photo', 'PHOTO']] as const} />
      </div>
      <div className="cam-bottom">
        <button className="cam-last" aria-label="Open Photos" onClick={(e) => openApp('photos', e.currentTarget)}>
          {last ? <Pic seed={last.seed} className="ugc" /> : <Video size={20} />}
        </button>
        <button className={`cam-shutter ${mode} ${rec != null ? 'rec' : ''}`} aria-label={mode === 'photo' ? 'Take photo' : rec != null ? 'Stop recording' : 'Record video'} onClick={shutter}>
          <i />
        </button>
        <button className="cam-flip" aria-label="Flip camera" onClick={() => setSelfie(!selfie)}>
          <SwitchCamera size={24} />
        </button>
      </div>
    </div>
  );
}
