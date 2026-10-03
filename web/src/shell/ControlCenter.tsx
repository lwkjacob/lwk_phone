import { type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { Bell, BellOff, Bluetooth, Calculator, Camera, FastForward, Flashlight, Moon, Pause, Plane, Play, Radio, Rewind, Signal, Sun, Timer, Volume2, Wifi } from 'lucide-react';
import { songs } from '../data';
import { S, openApp, skip, unlock, update, useS, viewportRect } from '../store';
import { Pic } from '../ui';

type SettingKey = 'airplane' | 'cellular' | 'wifi' | 'bluetooth' | 'dnd' | 'streamer' | 'silent';
const flip = (k: SettingKey) => update((s) => (s.settings[k] = !s.settings[k]));

function VSlider({ value, onChange, icon, label, min = 0 }: { value: number; onChange: (v: number) => void; icon: ReactNode; label: string; min?: number }) {
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const set = (y: number) => {
      const r = viewportRect(el);
      onChange(Math.min(1, Math.max(min, 1 - (y - r.top) / r.height)));
    };
    set(e.clientY);
    const move = (m: PointerEvent) => set(m.clientY);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true });
  };
  const onKey = (e: RKeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(Math.min(1, value + 0.1));
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(Math.max(min, value - 0.1));
  };
  return (
    <div className="cc-slider" role="slider" tabIndex={0} aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} onPointerDown={onDown} onKeyDown={onKey}>
      <i style={{ height: `${value * 100}%` }} />
      {icon}
    </div>
  );
}

export function ControlCenter() {
  const s = useS();
  const st = s.settings;
  const song = songs.find((x) => x.id === s.music.id);
  const close = () => update((x) => (x.cc = false));
  const go = (id: string) => {
    openApp(id);
    if (S.locked) unlock();
  };
  return (
    <div className={`cc ${s.cc ? 'show' : ''}`} inert={!s.cc} onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="cc-grid" onClick={(e) => e.target === e.currentTarget && close()}>
        <div className="cc-mod cc-conn">
          <button aria-label="Airplane Mode" aria-pressed={st.airplane} className="orange" onClick={() => flip('airplane')}>
            <Plane size={22} fill="currentColor" strokeWidth={0} />
          </button>
          <button aria-label="Mobile Data" aria-pressed={st.cellular && !st.airplane} className="green" onClick={() => flip('cellular')}>
            <Signal size={22} strokeWidth={3} />
          </button>
          <button aria-label="Wi-Fi" aria-pressed={st.wifi && !st.airplane} className="blue" onClick={() => flip('wifi')}>
            <Wifi size={22} strokeWidth={2.8} />
          </button>
          <button aria-label="Bluetooth" aria-pressed={st.bluetooth} className="blue" onClick={() => flip('bluetooth')}>
            <Bluetooth size={22} strokeWidth={2.6} />
          </button>
        </div>

        <div className="cc-mod cc-music">
          <button className="cc-np" onClick={() => go('music')} aria-label="Open Music">
            {song ? <Pic seed={song.seed} className="cc-art" /> : <span className="cc-art none" />}
            <span>
              <b>{song?.title ?? 'Not Playing'}</b>
              <small>{song?.artist ?? 'Music'}</small>
            </span>
          </button>
          <div className="cc-transport">
            <button aria-label="Previous" disabled={!song} onClick={() => skip(-1)}>
              <Rewind size={22} fill="currentColor" strokeWidth={0} />
            </button>
            <button aria-label={s.music.playing ? 'Pause' : 'Play'} onClick={() => (song ? update((x) => (x.music.playing = !x.music.playing)) : go('music'))}>
              {s.music.playing ? <Pause size={28} fill="currentColor" strokeWidth={0} /> : <Play size={28} fill="currentColor" strokeWidth={0} />}
            </button>
            <button aria-label="Next" disabled={!song} onClick={() => skip(1)}>
              <FastForward size={22} fill="currentColor" strokeWidth={0} />
            </button>
          </div>
        </div>

        <button className="cc-mod cc-btn" aria-label="Silent Mode" aria-pressed={st.silent} onClick={() => flip('silent')}>
          {st.silent ? <BellOff size={24} fill="currentColor" /> : <Bell size={24} fill="currentColor" />}
        </button>
        <button className="cc-mod cc-btn" aria-label="Streamer Mode" aria-pressed={st.streamer} onClick={() => flip('streamer')}>
          <Radio size={24} strokeWidth={2.4} />
        </button>
        <button className="cc-mod cc-focus" aria-pressed={st.dnd} onClick={() => flip('dnd')}>
          <span className="cc-focus-ic">
            <Moon size={20} fill="currentColor" strokeWidth={0} />
          </span>
          <span>
            <b>Do Not Disturb</b>
            <small>{st.dnd ? 'On' : 'Off'}</small>
          </span>
        </button>

        <VSlider label="Brightness" min={0.15} value={st.brightness} onChange={(v) => update((x) => (x.settings.brightness = v))} icon={<Sun size={26} fill="currentColor" />} />
        <VSlider label="Volume" value={st.silent ? 0 : st.volume} onChange={(v) => update((x) => ((x.settings.volume = v), (x.settings.silent = false)))} icon={<Volume2 size={26} fill="currentColor" />} />

        <button className="cc-mod cc-btn" aria-label="Flashlight" aria-pressed={s.flashlight} onClick={() => update((x) => (x.flashlight = !x.flashlight))}>
          <Flashlight size={24} fill="currentColor" />
        </button>
        <button className="cc-mod cc-btn" aria-label="Timer" onClick={() => go('clock')}>
          <Timer size={24} strokeWidth={2.4} />
        </button>
        <button className="cc-mod cc-btn" aria-label="Calculator" onClick={() => go('calc')}>
          <Calculator size={24} strokeWidth={2.2} />
        </button>
        <button className="cc-mod cc-btn" aria-label="Camera" onClick={() => go('camera')}>
          <Camera size={24} fill="currentColor" stroke="#3b3b3d" />
        </button>
      </div>
    </div>
  );
}
