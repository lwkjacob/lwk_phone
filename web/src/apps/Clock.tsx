import { useState } from 'react';
import { AlarmClock, Globe, Plus, Timer as TimerIcon, Watch } from 'lucide-react';
import { worldClocks } from '../data';
import { sfx } from '../sound';
import { actions, fmtTime, notify, pad, uid, update, useClock, useNow, useS } from '../store';
import { Empty, Field, Group, Page, Row, Seg, Sheet, Tabs, Toggle } from '../ui';
import { t } from '../i18n';

/* Stopwatch and timer outlive the tab (and the app), so their state lives at module level. */
const sw = { running: false, base: 0, start: 0, laps: [] as number[] };
const swElapsed = () => sw.base + (sw.running ? Date.now() - sw.start : 0);
const tm = { total: 0, end: 0, left: 0, running: false, handle: 0 };
const clocks = worldClocks;
const CITIES = [
  { city: 'Paleto Bay', offset: -7 },
  { city: 'Vice City', offset: -4 },
  { city: 'Paris', offset: 2 },
  { city: 'Dubai', offset: 4 },
  { city: 'Sydney', offset: 10 },
];

const fmtMs = (ms: number) => `${pad(Math.floor(ms / 60_000))}:${pad(Math.floor(ms / 1000) % 60)}.${pad(Math.floor(ms / 10) % 100)}`;

function World() {
  useS();
  const now = useClock(5000);
  const local = -new Date().getTimezoneOffset() / 60;
  return (
    <Page
      title={t('clock_world_clock')}
      large
      right={
        <button aria-label={t('clock_add_city')} onClick={() => actions({ title: t('clock_choose_a_city'), options: CITIES.filter((c) => !clocks.some((x) => x.city === c.city)).map((c) => ({ label: c.city, run: () => update(() => clocks.push(c)) })) })}>
          <Plus size={24} />
        </button>
      }
    >
      <div className="list">
        {clocks.map((c) => {
          const diff = c.offset - local;
          return (
            <div key={c.city} className="row clock-row">
              <span className="row-main">
                <span className="row-s">{t('clock_today')}{' '}{diff === 0 ? t('clock_same_time') : t('clock_xdiffhrs', { x: diff > 0 ? '+' : '', diff })}</span>
                <span className="row-t">{c.city}</span>
              </span>
              <strong>{fmtTime(now + diff * 3_600_000)}</strong>
              <button aria-label={t('clock_remove_city', { city: c.city })} className="clock-del" onClick={() => update(() => clocks.splice(clocks.indexOf(c), 1))}>
                ×
              </button>
            </div>
          );
        })}
      </div>
    </Page>
  );
}

function AlarmSheet({ id, onClose }: { id?: number; onClose: () => void }) {
  const s = useS();
  const a = s.alarms.find((x) => x.id === id);
  const [time, setTime] = useState(a?.time ?? '08:00');
  const [label, setLabel] = useState(a?.label ?? 'Alarm');
  const [days, setDays] = useState(a?.days ?? 'Never');
  const save = () =>
    update((x) => {
      if (a) Object.assign(a, { time, label, days });
      else x.alarms.push({ id: uid(), time, label, days, on: true });
    });
  return (
    <Sheet title={a ? t('clock_edit_alarm') : t('clock_add_alarm')} onClose={onClose} action={{ label: t('save'), run: save }}>
      {(close) => (
        <>
          <input className="time-input" type="time" aria-label={t('clock_time')} value={time} onChange={(e) => setTime(e.target.value || time)} />
          <Group>
            <Field label={t('clock_label')} value={label} onChange={setLabel} />
          </Group>
          <div className="pad-x">
            <Seg value={days} onChange={setDays} options={[['Never', t('clock_once')], ['Weekdays', t('clock_weekdays')], ['Every Day', t('clock_every_day')]] as const} />
          </div>
          {a && (
            <Group>
              <Row tone="danger" title={t('clock_delete_alarm')} onClick={() => (update((x) => (x.alarms = x.alarms.filter((y) => y !== a))), close())} />
            </Group>
          )}
        </>
      )}
    </Sheet>
  );
}

function Alarms() {
  const s = useS();
  const [edit, setEdit] = useState<number | 'new' | null>(null);
  const show = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return fmtTime(new Date(2000, 0, 1, h, m), true);
  };
  return (
    <Page
      title={t('clock_alarms')}
      large
      right={
        <button aria-label={t('clock_add_alarm_2')} onClick={() => setEdit('new')}>
          <Plus size={24} />
        </button>
      }
    >
      {s.alarms.length ? (
        <div className="list">
          {[...s.alarms]
            .sort((a, b) => a.time.localeCompare(b.time))
            .map((a) => (
              <div key={a.id} className={`row split alarm ${a.on ? '' : 'off'}`}>
                <button className="row-btn" onClick={() => setEdit(a.id)}>
                  <span className="row-main">
                    <strong>{show(a.time)}</strong>
                    <span className="row-s">
                      {a.label}
                      {a.days !== 'Never' && `, ${a.days}`}
                    </span>
                  </span>
                </button>
                <Toggle label={`${a.label} ${a.time}`} on={a.on} onChange={(v) => update(() => (a.on = v))} />
              </div>
            ))}
        </div>
      ) : (
        <Empty icon={<AlarmClock size={44} />} title={t('clock_no_alarms')} />
      )}
      {edit != null && <AlarmSheet id={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </Page>
  );
}

function Stopwatch() {
  useS();
  useNow(sw.running ? 47 : 1000);
  const ms = swElapsed();
  const lapStart = sw.laps.reduce((a, b) => a + b, 0);
  const startStop = () =>
    update(() => {
      if (sw.running) sw.base = swElapsed();
      else sw.start = Date.now();
      sw.running = !sw.running;
    });
  const lapReset = () =>
    update(() => {
      if (sw.running) sw.laps.push(ms - lapStart);
      else Object.assign(sw, { base: 0, laps: [] });
    });
  return (
    <div className="stopwatch">
      <output>{fmtMs(ms)}</output>
      <div className="round-row">
        <button className="round" disabled={!ms} onClick={lapReset}>
          {sw.running || !ms ? t('clock_lap') : t('clock_reset')}
        </button>
        <button className={`round ${sw.running ? 'stop' : 'go'}`} onClick={startStop}>
          {sw.running ? t('clock_stop') : t('clock_start')}
        </button>
      </div>
      <div className="laps">
        {ms > 0 && (
          <div>
            <span>{t('clock_lap')}{' '}{sw.laps.length + 1}</span>
            <span>{fmtMs(ms - lapStart)}</span>
          </div>
        )}
        {[...sw.laps].reverse().map((l, i) => (
          <div key={sw.laps.length - i}>
            <span>{t('clock_lap')}{' '}{sw.laps.length - i}</span>
            <span>{fmtMs(l)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function finish() {
  sfx('alarm');
  notify({ app: 'clock', title: t('timer'), body: t('clock_your_timer_is_done') });
  update(() => Object.assign(tm, { total: 0, running: false }));
}

function Timer() {
  useS();
  const now = useNow(250);
  const [mins, setMins] = useState(5);
  const left = tm.total ? (tm.running ? Math.max(0, tm.end - now) : tm.left) : 0;
  const start = (ms: number) =>
    update(() => {
      window.clearTimeout(tm.handle);
      Object.assign(tm, { total: tm.total || ms, end: Date.now() + ms, running: true, handle: window.setTimeout(finish, ms) });
    });
  const pause = () =>
    update(() => {
      window.clearTimeout(tm.handle);
      Object.assign(tm, { left: tm.end - Date.now(), running: false });
    });
  const cancel = () =>
    update(() => {
      window.clearTimeout(tm.handle);
      Object.assign(tm, { total: 0, running: false });
    });
  const R = 150;
  const C = 2 * Math.PI * R;
  const sec = Math.ceil(left / 1000);
  return (
    <div className="stopwatch">
      {tm.total ? (
        <div className="timer-ring">
          <svg viewBox="0 0 320 320" aria-hidden="true">
            <circle cx="160" cy="160" r={R} />
            <circle cx="160" cy="160" r={R} className="fg" strokeDasharray={C} strokeDashoffset={C * (1 - left / tm.total)} />
          </svg>
          <output>
            {sec >= 3600 && `${Math.floor(sec / 3600)}:`}
            {pad(Math.floor(sec / 60) % 60)}:{pad(sec % 60)}
          </output>
        </div>
      ) : (
        <div className="timer-pick">
          {[1, 3, 5, 10, 15, 30, 45, 60, 90].map((m) => (
            <button key={m} aria-pressed={mins === m} onClick={() => setMins(m)}>
              <b>{m < 60 ? m : m / 60}</b>
              {m < 60 ? t('clock_min') : m === 60 ? t('clock_hour') : t('clock_hours')}
            </button>
          ))}
        </div>
      )}
      <div className="round-row">
        <button className="round" disabled={!tm.total} onClick={cancel}>
          {t('cancel')}
        </button>
        {tm.total ? (
          <button className={`round ${tm.running ? 'pause' : 'go'}`} onClick={() => (tm.running ? pause() : start(tm.left))}>
            {tm.running ? t('pause') : t('clock_resume')}
          </button>
        ) : (
          <button className="round go" onClick={() => start(mins * 60_000)}>
            {t('clock_start')}
          </button>
        )}
      </div>
    </div>
  );
}

export function ClockApp() {
  return (
    <Tabs
      tabs={[
        { id: 'world', label: t('clock_world_clock'), icon: <Globe size={24} />, view: <World /> },
        { id: 'alarms', label: t('clock_alarms'), icon: <AlarmClock size={24} fill="currentColor" stroke="var(--bar-solid)" />, view: <Alarms /> },
        { id: 'stopwatch', label: t('clock_stopwatch'), icon: <Watch size={24} />, view: <Stopwatch /> },
        { id: 'timer', label: t('clock_timers'), icon: <TimerIcon size={24} />, view: <Timer /> },
      ]}
    />
  );
}
