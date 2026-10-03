import { useState, type ReactNode } from 'react';
import { Grip, MessageCircle, MicOff, Phone, Plus, SwitchCamera, User, Video, VideoOff, Volume2 } from 'lucide-react';
import { answer, chatWith, fmtDur, hangup, nameOf, openApp, update, useNow, useS, type Call } from '../store';
import { Avatar, DialPad, Pic } from '../ui';
import { t } from '../i18n';

function CallBtn({ label, on, onClick, children }: { label: string; on?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <div className="call-btn">
      <button aria-label={label} aria-pressed={on} onClick={onClick}>
        {children}
      </button>
      <span>{label}</span>
    </div>
  );
}

function CallView({ c }: { c: Call }) {
  const now = useNow();
  const [pad, setPad] = useState(false);
  const [typed, setTyped] = useState('');
  const name = nameOf(c.number);
  const live = c.state === 'active';
  const status = c.state === 'incoming' ? (c.video ? t('sys_incoming_video_call') : t('sys_mobile')) : c.state === 'outgoing' ? t('sys_calling') : fmtDur(Math.max(0, (now - c.start) / 1000));
  const set = (patch: Partial<Call>) => update((s) => s.call && Object.assign(s.call, patch));
  const video = c.video && live;

  return (
    <div className={`call ${video ? 'video' : ''}`} role="dialog" aria-label={t('sys_call_with_name', { name })}>
      {video && (
        <>
          <Pic seed={name.length * 7 + 3} className="call-remote ugc" alt={t('sys_names_camera', { name })} />
          <Pic seed={21} className="call-self ugc" alt={t('sys_your_camera')} />
        </>
      )}
      <div className="call-head">
        {!video && <Avatar name={name} size={96} />}
        <h2>{name}</h2>
        <p>{status}</p>
      </div>

      {c.state === 'incoming' ? (
        <div className="call-in">
          <button className="call-msg" onClick={() => (hangup(), openApp('messages', null, { chat: chatWith(c.number) }))}>
            <MessageCircle size={18} fill="currentColor" strokeWidth={0} />{' '}{t('message')}
          </button>
          <div className="call-in-row">
            <CallBtn label={t('sys_decline')} onClick={hangup}>
              <span className="call-round red">
                <Phone size={32} fill="currentColor" strokeWidth={0} className="hang" />
              </span>
            </CallBtn>
            <CallBtn label={t('sys_accept')} onClick={answer}>
              <span className="call-round green">{c.video ? <Video size={32} fill="currentColor" strokeWidth={0} /> : <Phone size={32} fill="currentColor" strokeWidth={0} />}</span>
            </CallBtn>
          </div>
        </div>
      ) : (
        <div className="call-ctl">
          {pad ? (
            <div className="call-pad">
              <output>{typed}</output>
              <DialPad onKey={(k) => setTyped((t) => t + k)} />
            </div>
          ) : (
            <div className="call-grid">
              <CallBtn label={t('sys_mute')} on={c.muted} onClick={() => set({ muted: !c.muted })}>
                <MicOff size={30} />
              </CallBtn>
              {video ? (
                <CallBtn label={t('sys_flip')} onClick={() => {}}>
                  <SwitchCamera size={30} />
                </CallBtn>
              ) : (
                <CallBtn label={t('keypad')} onClick={() => setPad(true)}>
                  <Grip size={30} />
                </CallBtn>
              )}
              <CallBtn label={t('sys_speaker')} on={c.speaker} onClick={() => set({ speaker: !c.speaker })}>
                <Volume2 size={30} fill="currentColor" />
              </CallBtn>
              <CallBtn label={t('sys_add_call')} onClick={() => openApp('phone')}>
                <Plus size={30} strokeWidth={2.6} />
              </CallBtn>
              <CallBtn label={c.video ? t('sys_stop_video') : t('video')} on={c.video} onClick={() => set({ video: !c.video })}>
                {c.video ? <VideoOff size={30} /> : <Video size={30} fill="currentColor" />}
              </CallBtn>
              <CallBtn label={t('contacts')} onClick={() => openApp('phone')}>
                <User size={30} fill="currentColor" />
              </CallBtn>
            </div>
          )}
          <div className="call-end">
            <button className="call-round red" aria-label={t('sys_end_call')} onClick={hangup}>
              <Phone size={32} fill="currentColor" strokeWidth={0} className="hang" />
            </button>
            {pad && (
              <button className="call-hide" onClick={() => setPad(false)}>
                {t('sys_hide')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CallScreen() {
  const c = useS().call;
  return c && !c.min ? <CallView key={c.number} c={c} /> : null;
}
