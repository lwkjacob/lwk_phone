import { useEffect, useState } from 'react';
import { Heart, Image as ImageIcon, Play, Share, SwitchCamera, Trash2, Video, Zap, ZapOff } from 'lucide-react';
import type { Photo } from '../data';
import { sfx } from '../sound';
import { S, addPhoto, confirm, fmtDur, fmtTime, openApp, share, update, useNow, useS } from '../store';
import { Empty, Page, Pic, Seg, Sheet, Tabs, useNav } from '../ui';
import { intl, t } from '../i18n';

/* ---------- Photos ---------- */

/** `name` is a locale key: this table is built before the language is known. */
const ALBUMS = [
  { id: 'recents', name: 'media_album_recents', test: (_: Photo) => true },
  { id: 'favorites', name: 'media_album_favorites', test: (p: Photo) => !!p.fav },
  { id: 'videos', name: 'media_album_videos', test: (p: Photo) => !!p.video },
  { id: 'selfies', name: 'media_album_selfies', test: (p: Photo) => !!p.selfie },
];

function Thumb({ p, onClick }: { p: Photo; onClick: () => void }) {
  return (
    <Pic seed={p.seed} className="ugc" alt={p.video ? t('video') : t('media_photo')} onClick={onClick}>
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
          {d.toLocaleDateString(intl, { month: 'long', day: 'numeric' })}
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
            <button aria-label={t('share')} onClick={() => share({ kind: p.video ? t('kind_video') : t('kind_photo'), label: p.video ? t('video') : t('media_photo'), seed: p.seed })}>
              <Share size={24} />
            </button>
            <button aria-label={t('media_favorite')} aria-pressed={!!p.fav} onClick={() => update(() => (p.fav = !p.fav))}>
              <Heart size={24} fill={p.fav ? 'currentColor' : 'none'} />
            </button>
            <button aria-label={t('delete')} onClick={() => confirm(p.video ? t('media_delete_video') : t('media_delete_photo'), t('media_this_item_will_be_deleted_from'), t('delete'), () => update((x) => (x.photos = x.photos.filter((y) => y !== p))))}>
              <Trash2 size={24} />
            </button>
          </div>
        </div>
      }
    >
      <Pic seed={p.seed} className={`viewer-pic ugc ${playing ? 'pan' : ''}`} alt={p.video ? t('video') : t('media_photo')}>
        {p.video && !playing && (
          <button className="viewer-play" aria-label={t('media_play_video')} onClick={() => setPlaying(true)}>
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
  if (!list.length) return <Empty icon={<ImageIcon size={44} />} title={t('media_no_photos_or_videos')} text={t('media_take_photos_with_camera_and_they')} />;
  return (
    <>
      <div className="pgrid">
        {list.map((p) => (
          <Thumb key={p.id} p={p} onClick={() => nav.push(<Viewer id={p.id} album={album} />)} />
        ))}
      </div>
      <p className="pgrid-count">
        {list.filter((p) => !p.video).length}{' '}{t('media_photos_count_videos', { count: list.filter((p) => p.video).length })}
      </p>
    </>
  );
}

function Albums() {
  const s = useS();
  const nav = useNav();
  return (
    <Page title={t('media_albums')} large>
      <div className="albums">
        {ALBUMS.map((a) => {
          const list = s.photos.filter(a.test);
          return (
            <button
              key={a.id}
              onClick={() =>
                nav.push(
                  <Page title={t(a.name)} back={t('media_albums')}>
                    <Grid album={a.id} />
                  </Page>,
                )
              }
            >
              {list[0] ? <Pic seed={list[0].seed} className="ugc" /> : <span className="pic none" />}
              <b>{t(a.name)}</b>
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
          label: t('library'),
          icon: <ImageIcon size={24} fill="currentColor" stroke="var(--bar-solid)" />,
          view: (
            <Page title={t('library')} large>
              <Grid album="recents" />
            </Page>
          ),
        },
        { id: 'albums', label: t('media_albums'), icon: <ImageIcon size={24} />, view: <Albums /> },
      ]}
    />
  );
}

/** Sheet for attaching a photo from the library (Messages, social apps, listings). */
export function PhotoPicker({ onPick, onClose, videos }: { onPick: (seed: number) => void; onClose: () => void; videos?: boolean }) {
  const list = S.photos.filter((p) => (videos ? p.video : !p.video));
  return (
    <Sheet title={videos ? t('media_videos') : t('photos')} onClose={onClose}>
      {(close) =>
        list.length ? (
          <div className="pgrid">
            {list.map((p) => (
              <Thumb key={p.id} p={p} onClick={() => (onPick(p.seed), close())} />
            ))}
          </div>
        ) : (
          <Empty icon={<ImageIcon size={44} />} title={videos ? t('no_videos') : t('media_no_photos')} text={t('media_capture_something_with_camera_first')} />
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
        <button aria-label={t('media_flash')} aria-pressed={flash} onClick={() => (setFlash(!flash), update((x) => (x.flashlight = !flash)))}>
          {flash ? <Zap size={18} fill="currentColor" /> : <ZapOff size={18} />}
        </button>
        {rec != null && <span className="cam-timer">{fmtDur((now - rec) / 1000)}</span>}
        <span />
      </div>
      <div className="cam-view">
        <Pic seed={seed} className="cam-scene" alt={t('media_viewfinder')} style={{ transform: `scale(${zoom})` }} />
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
        <Seg value={mode} onChange={(m) => rec == null && setMode(m)} options={[['video', t('media_video')], ['photo', t('media_photo_2')]] as const} />
      </div>
      <div className="cam-bottom">
        <button className="cam-last" aria-label={t('media_open_photos')} onClick={(e) => openApp('photos', e.currentTarget)}>
          {last ? <Pic seed={last.seed} className="ugc" /> : <Video size={20} />}
        </button>
        <button className={`cam-shutter ${mode} ${rec != null ? 'rec' : ''}`} aria-label={mode === 'photo' ? t('media_take_photo') : rec != null ? t('stop_recording') : t('media_record_video')} onClick={shutter}>
          <i />
        </button>
        <button className="cam-flip" aria-label={t('media_flip_camera')} onClick={() => setSelfie(!selfie)}>
          <SwitchCamera size={24} />
        </button>
      </div>
    </div>
  );
}
