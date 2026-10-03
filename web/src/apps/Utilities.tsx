import { useEffect, useState } from 'react';
import { CloudSun, Droplets, Eye, Mic, Pause, Play, Share, SquarePen, Sun, Sunset, Thermometer, Trash2, Wind } from 'lucide-react';
import { CALC0, OPS, calcKey } from '../calc';
import { weather } from '../data';
import { S, confirm, fmtAgo, fmtDur, prompt, share, uid, update, useNow, useS } from '../store';
import { Empty, Group, Page, Row, Search, Stack, WEATHER_ICONS, Wave, useDragScroll, useNav } from '../ui';

/* ---------- Notes ---------- */

function NoteView({ id }: { id: number }) {
  const s = useS();
  const nav = useNav();
  const n = s.notes.find((x) => x.id === id);
  if (!n) return null;
  const text = n.title + (n.body ? `\n${n.body}` : '');
  const save = (v: string) => {
    const [title, ...rest] = v.split('\n');
    update(() => Object.assign(n, { title, body: rest.join('\n'), time: Date.now() }));
  };
  return (
    <Page
      className="note"
      back="Notes"
      right={
        <>
          <button aria-label="Share note" onClick={() => share({ kind: 'Note', label: n.title || 'New Note' })}>
            <Share size={22} />
          </button>
          <button aria-label="Delete note" onClick={() => (nav.pop(), update((x) => (x.notes = x.notes.filter((y) => y.id !== id))))}>
            <Trash2 size={22} />
          </button>
        </>
      }
    >
      <textarea aria-label="Note" autoFocus={!text} value={text} placeholder="Title" onChange={(e) => save(e.target.value)} />
    </Page>
  );
}

function NoteList() {
  const s = useS();
  const nav = useNav();
  const [q, setQ] = useState('');
  const list = s.notes.filter((n) => `${n.title} ${n.body}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.time - a.time);
  const create = () => {
    const note = { id: uid(), title: '', body: '', time: Date.now() };
    update((x) => x.notes.unshift(note));
    nav.push(<NoteView id={note.id} />);
  };
  return (
    <Page
      title="Notes"
      large
      footer={
        <div className="toolbar">
          <span className="toolbar-note">{s.notes.length} Notes</span>
          <button aria-label="New note" onClick={create}>
            <SquarePen size={22} />
          </button>
        </div>
      }
    >
      <Search value={q} onChange={setQ} />
      {list.length ? (
        <Group>
          {list.map((n) => (
            <Row key={n.id} title={<b>{n.title || 'New Note'}</b>} sub={`${fmtAgo(n.time)}  ${n.body.split('\n')[0] || 'No additional text'}`} onClick={() => nav.push(<NoteView id={n.id} />)} />
          ))}
        </Group>
      ) : (
        <Empty icon={<SquarePen size={44} />} title="No Notes" text={q ? `Nothing matches “${q}”.` : 'Tap the compose button to write one.'} />
      )}
    </Page>
  );
}

export function NotesApp() {
  return (
    <Stack>
      <NoteList />
    </Stack>
  );
}

/* ---------- Calculator ---------- */

const KEYS = ['AC', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '='];

export function CalculatorApp() {
  const [c, setC] = useState(CALC0);
  useEffect(() => {
    const map: Record<string, string> = { '/': '÷', '*': '×', '-': '−', Enter: '=', Escape: 'AC', c: 'AC' };
    const onKey = (e: KeyboardEvent) => {
      const k = map[e.key] ?? e.key;
      if (KEYS.includes(k)) setC((x) => calcKey(x, k));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const n = Number(c.cur);
  const shown = c.cur === 'Error' || c.cur.endsWith('.') || Math.abs(n) >= 1e9 ? c.cur : n.toLocaleString('en-US', { maximumFractionDigits: 8 });
  return (
    <div className="calc">
      <output style={{ fontSize: shown.length > 9 ? 52 : shown.length > 6 ? 68 : 88 }}>{shown}</output>
      <div className="calc-keys">
        {KEYS.map((k) => (
          <button key={k} className={`${k in OPS || k === '=' ? 'op' : /[\d.]/.test(k) ? '' : 'fn'} ${k === '0' ? 'wide' : ''}`} aria-pressed={c.op === k && c.fresh ? true : undefined} onClick={() => setC(calcKey(c, k))}>
            {k === 'AC' && c.cur !== '0' && !c.fresh ? 'C' : k}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Weather ---------- */

export function WeatherApp() {
  const w = weather;
  const hours = useDragScroll<HTMLDivElement>('x');
  const lo = Math.min(...w.daily.map((d) => d[2]));
  const hi = Math.max(...w.daily.map((d) => d[3]));
  const icon = (k: string, size = 22) => {
    const I = WEATHER_ICONS[k as keyof typeof WEATHER_ICONS];
    return <I size={size} fill={k === 'sun' ? '#ffd60a' : '#fff'} stroke={k === 'sun' ? '#ffd60a' : '#fff'} />;
  };
  return (
    <div className="weather">
      <header>
        <h1>{w.city}</h1>
        <strong>{w.temp}°</strong>
        <p>{w.cond}</p>
        <p>
          H:{w.hi}° L:{w.lo}°
        </p>
      </header>
      <section className="w-card">
        <h2>Sunny conditions will continue this afternoon. Rain expected around 7PM.</h2>
        <div className="w-hours" ref={hours}>
          {w.hourly.map(([t, k, temp]) => (
            <div key={t}>
              <span>{t}</span>
              {icon(k)}
              <b>{temp}°</b>
            </div>
          ))}
        </div>
      </section>
      <section className="w-card">
        <h2 className="caps">7-Day Forecast</h2>
        {w.daily.map(([day, k, a, b]) => (
          <div key={day} className="w-day">
            <b>{day}</b>
            {icon(k, 20)}
            <span>{a}°</span>
            <i>
              <i style={{ left: `${((a - lo) / (hi - lo)) * 100}%`, right: `${((hi - b) / (hi - lo)) * 100}%` }} />
            </i>
            <b>{b}°</b>
          </div>
        ))}
      </section>
      <div className="w-tiles">
        {(
          [
            [<Sun size={13} />, 'UV Index', String(w.uv), 'High'],
            [<Sunset size={13} />, 'Sunset', w.sunset, 'Sunrise: 6:14 AM'],
            [<Wind size={13} />, 'Wind', `${w.wind} km/h`, 'Gusts to 24 km/h'],
            [<Thermometer size={13} />, 'Feels Like', `${w.feels}°`, 'Similar to the actual temperature.'],
            [<Droplets size={13} />, 'Humidity', `${w.humidity}%`, 'The dew point is 12° right now.'],
            [<Eye size={13} />, 'Visibility', `${w.visibility} km`, 'Perfectly clear view.'],
          ] as const
        ).map(([ic, label, value, note]) => (
          <section key={label} className="w-card">
            <h2 className="caps">
              {ic} {label}
            </h2>
            <strong>{value}</strong>
            <p>{note}</p>
          </section>
        ))}
      </div>
      <footer>
        <CloudSun size={14} /> Weather for San Andreas
      </footer>
    </div>
  );
}

/* ---------- Voice Memos ---------- */

export function MemosApp() {
  const s = useS();
  const now = useNow(250);
  const [open, setOpen] = useState<number | null>(null);
  const [play, setPlay] = useState<{ id: number; from: number } | null>(null);
  const cur = s.memos.find((m) => m.id === play?.id);
  const pos = play && cur ? Math.min(cur.dur, (now - play.from) / 1000) : 0;
  useEffect(() => {
    if (cur && pos >= cur.dur) setPlay(null);
  }, [cur, pos]);

  const toggleRec = () => {
    if (S.rec == null) return update((x) => (x.rec = Date.now()));
    const dur = Math.max(1, Math.round((Date.now() - S.rec) / 1000));
    update((x) => {
      x.memos.unshift({ id: uid(), name: `New Recording ${x.memos.length + 1}`, time: Date.now(), dur });
      x.rec = null;
    });
  };

  return (
    <Stack>
      <Page
        title="All Recordings"
        large
        footer={
          <div className={`memo-rec ${s.rec != null ? 'on' : ''}`}>
            {s.rec != null && (
              <>
                <Wave count={36} live />
                <time>{fmtDur((now - s.rec) / 1000)}</time>
              </>
            )}
            <button aria-label={s.rec != null ? 'Stop recording' : 'Record'} onClick={toggleRec}>
              <i />
            </button>
          </div>
        }
      >
        {s.memos.length ? (
          <div className="list">
            {s.memos.map((m) => (
              <div key={m.id} className={`vm ${open === m.id ? 'open' : ''}`}>
                <button className="row-btn" aria-expanded={open === m.id} onClick={() => setOpen(open === m.id ? null : m.id)}>
                  <span className="row-main">
                    <span className="row-t">
                      <b>{m.name}</b>
                    </span>
                    <span className="row-s">{fmtAgo(m.time)}</span>
                  </span>
                  <span className="row-v">{fmtDur(m.dur)}</span>
                </button>
                {open === m.id && (
                  <div className="vm-body">
                    <div className="memo-bar">
                      <i style={{ width: `${play?.id === m.id ? (pos / m.dur) * 100 : 0}%` }} />
                    </div>
                    <div className="memo-times">
                      <span>{fmtDur(play?.id === m.id ? pos : 0)}</span>
                      <span>-{fmtDur(m.dur - (play?.id === m.id ? pos : 0))}</span>
                    </div>
                    <div className="vm-acts">
                      <button aria-label="Share" onClick={() => share({ kind: 'Voice Memo', label: m.name })}>
                        <Share size={20} />
                      </button>
                      <button aria-label={play?.id === m.id ? 'Pause' : 'Play'} onClick={() => setPlay(play?.id === m.id ? null : { id: m.id, from: Date.now() })}>
                        {play?.id === m.id ? <Pause size={26} fill="currentColor" strokeWidth={0} /> : <Play size={26} fill="currentColor" strokeWidth={0} />}
                      </button>
                      <button onClick={() => prompt('Rename Recording', 'Name', (v) => update(() => (m.name = v)), m.name)}>Rename</button>
                      <button aria-label="Delete" className="danger" onClick={() => confirm('Delete Recording', `“${m.name}” will be deleted.`, 'Delete', () => update((x) => (x.memos = x.memos.filter((y) => y !== m))))}>
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty icon={<Mic size={44} />} title="No Recordings" text="Tap the record button to start a voice memo." />
        )}
      </Page>
    </Stack>
  );
}
