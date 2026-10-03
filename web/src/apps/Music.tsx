import { useState } from 'react';
import { Ellipsis, FastForward, House, Library, ListMusic, Music as MusicIcon, Pause, Play, Plus, Rewind, Search as SearchIcon, Shuffle, Volume1, Volume2 } from 'lucide-react';
import { playlists, songs } from '../data';
import { actions, fmtDur, playSong, prompt, skip, uid, update, useS } from '../store';
import { Empty, Page, Pic, Search, Seg, Sheet, Tabs, useDragScroll, useNav } from '../ui';

const songOf = (id: number | null) => songs.find((x) => x.id === id);
const toggle = () => update((s) => (s.music.playing = !s.music.playing));

function SongRow({ id, queue }: { id: number; queue: number[] }) {
  const s = useS();
  const song = songOf(id)!;
  const on = s.music.id === id;
  return (
    <div className="row split">
      <button className="row-btn" onClick={() => playSong(id, queue)}>
        <Pic seed={song.seed} className="song-art" alt={song.album} />
        <span className="row-main">
          <span className={`row-t ${on ? 'tint' : ''}`}>{song.title}</span>
          <span className="row-s">{song.artist}</span>
        </span>
        <span className="row-v">{fmtDur(song.dur)}</span>
      </button>
      <button
        className="row-info"
        aria-label={`More for ${song.title}`}
        onClick={() => actions({ title: song.title, options: playlists.map((p) => ({ label: `Add to ${p.name}`, run: () => update(() => p.songs.includes(id) || p.songs.push(id)) })) })}
      >
        <Ellipsis size={20} />
      </button>
    </div>
  );
}

function PlaylistView({ id }: { id: number }) {
  useS();
  const nav = useNav();
  const p = playlists.find((x) => x.id === id);
  if (!p) return null;
  return (
    <Page
      back="Library"
      right={
        <button className="danger" onClick={() => (nav.pop(), update(() => playlists.splice(playlists.indexOf(p), 1)))}>
          Delete
        </button>
      }
    >
      <div className="pl-hero">
        <Pic seed={p.seed} alt={p.name} />
        <h1>{p.name}</h1>
        <p>{p.songs.length} songs</p>
        <div className="btn-row">
          <button className="btn soft" disabled={!p.songs.length} onClick={() => playSong(p.songs[0], p.songs)}>
            <Play size={18} fill="currentColor" /> Play
          </button>
          <button className="btn soft" disabled={!p.songs.length} onClick={() => playSong(p.songs[Math.floor(Math.random() * p.songs.length)], p.songs)}>
            <Shuffle size={18} /> Shuffle
          </button>
        </div>
      </div>
      <div className="list">
        {p.songs.map((sid) => (
          <SongRow key={sid} id={sid} queue={p.songs} />
        ))}
      </div>
    </Page>
  );
}

function ListenNow() {
  const row = useDragScroll<HTMLDivElement>('x');
  const albums = songs.filter((x, i) => songs.findIndex((y) => y.album === x.album) === i);
  return (
    <Page title="Listen Now" large>
      <h2 className="sec-h">Top Picks</h2>
      <div className="hscroll" ref={row}>
        {albums.map((a) => (
          <button key={a.album} className="album" onClick={() => playSong(a.id, songs.filter((x) => x.album === a.album).map((x) => x.id))}>
            <Pic seed={a.seed} alt={a.album} />
            <b>{a.album}</b>
            <small>{a.artist}</small>
          </button>
        ))}
      </div>
      <h2 className="sec-h">Recently Played</h2>
      <div className="list">
        {songs.slice(0, 5).map((x) => (
          <SongRow key={x.id} id={x.id} queue={songs.map((y) => y.id)} />
        ))}
      </div>
    </Page>
  );
}

function LibraryView() {
  useS();
  const nav = useNav();
  const [view, setView] = useState<'songs' | 'playlists'>('playlists');
  return (
    <Page
      title="Library"
      large
      right={
        <button aria-label="New playlist" onClick={() => prompt('New Playlist', 'Playlist name', (name) => update(() => playlists.push({ id: uid(), name, songs: [], seed: Math.floor(Math.random() * 90) })))}>
          <Plus size={24} />
        </button>
      }
    >
      <div className="pad-x">
        <Seg value={view} onChange={setView} options={[['playlists', 'Playlists'], ['songs', 'Songs']] as const} />
      </div>
      <div className="list">
        {view === 'songs'
          ? songs.map((x) => <SongRow key={x.id} id={x.id} queue={songs.map((y) => y.id)} />)
          : playlists.map((p) => (
              <button key={p.id} className="row" onClick={() => nav.push(<PlaylistView id={p.id} />)}>
                <Pic seed={p.seed} className="song-art big" alt="" />
                <span className="row-main">
                  <span className="row-t">{p.name}</span>
                  <span className="row-s">Playlist · {p.songs.length} songs</span>
                </span>
              </button>
            ))}
      </div>
      {view === 'playlists' && !playlists.length && <Empty icon={<ListMusic size={44} />} title="No Playlists" text="Tap + to create one." />}
    </Page>
  );
}

function SearchView() {
  const [q, setQ] = useState('');
  const list = songs.filter((x) => `${x.title} ${x.artist} ${x.album}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Page title="Search" large>
      <Search value={q} onChange={setQ} placeholder="Artists, Songs, Albums" />
      <div className="list">
        {list.map((x) => (
          <SongRow key={x.id} id={x.id} queue={list.map((y) => y.id)} />
        ))}
      </div>
      {!list.length && <Empty icon={<MusicIcon size={44} />} title="No Results" text={`Nothing matches “${q}”.`} />}
    </Page>
  );
}

function NowPlaying({ onClose }: { onClose: () => void }) {
  const s = useS();
  const song = songOf(s.music.id);
  if (!song) return null;
  return (
    <Sheet onClose={onClose} cancel="Close">
      <div className="np">
        <Pic seed={song.seed} className={`np-art ${s.music.playing ? 'on' : ''}`} alt={song.album} />
        <div className="np-title">
          <b>{song.title}</b>
          <span>{song.artist}</span>
        </div>
        <input className="range" type="range" aria-label="Position" min={0} max={song.dur} value={s.music.pos} onChange={(e) => update((x) => (x.music.pos = Number(e.target.value)))} />
        <div className="memo-times">
          <span>{fmtDur(s.music.pos)}</span>
          <span>-{fmtDur(song.dur - s.music.pos)}</span>
        </div>
        <div className="np-ctl">
          <button aria-label="Previous" onClick={() => skip(-1)}>
            <Rewind size={34} fill="currentColor" strokeWidth={0} />
          </button>
          <button aria-label={s.music.playing ? 'Pause' : 'Play'} onClick={toggle}>
            {s.music.playing ? <Pause size={46} fill="currentColor" strokeWidth={0} /> : <Play size={46} fill="currentColor" strokeWidth={0} />}
          </button>
          <button aria-label="Next" onClick={() => skip(1)}>
            <FastForward size={34} fill="currentColor" strokeWidth={0} />
          </button>
        </div>
        <div className="np-vol">
          <Volume1 size={16} />
          <input className="range" type="range" aria-label="Volume" min={0} max={1} step={0.05} value={s.settings.volume} onChange={(e) => update((x) => (x.settings.volume = Number(e.target.value)))} />
          <Volume2 size={16} />
        </div>
      </div>
    </Sheet>
  );
}

export function MusicApp() {
  const s = useS();
  const [full, setFull] = useState(false);
  const song = songOf(s.music.id);
  return (
    <>
      <Tabs
        accessory={
          <div className="mini">
            <button className="mini-main" disabled={!song} onClick={() => setFull(true)}>
              {song ? <Pic seed={song.seed} alt="" /> : <span className="pic none" />}
              <span>{song?.title ?? 'Not Playing'}</span>
            </button>
            <button aria-label={s.music.playing ? 'Pause' : 'Play'} disabled={!song} onClick={toggle}>
              {s.music.playing ? <Pause size={22} fill="currentColor" strokeWidth={0} /> : <Play size={22} fill="currentColor" strokeWidth={0} />}
            </button>
            <button aria-label="Next" disabled={!song} onClick={() => skip(1)}>
              <FastForward size={22} fill="currentColor" strokeWidth={0} />
            </button>
          </div>
        }
        tabs={[
          { id: 'now', label: 'Listen Now', icon: <House size={24} fill="currentColor" stroke="var(--bar-solid)" />, view: <ListenNow /> },
          { id: 'library', label: 'Library', icon: <Library size={24} />, view: <LibraryView /> },
          { id: 'search', label: 'Search', icon: <SearchIcon size={24} strokeWidth={2.6} />, view: <SearchView /> },
        ]}
      />
      {full && <NowPlaying onClose={() => setFull(false)} />}
    </>
  );
}
