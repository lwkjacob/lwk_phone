import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Grip, MessageCircle, MicOff, Phone, Plus, SwitchCamera, User, Video, VideoOff, Volume2 } from 'lucide-react';
import { answer, chatWith, fmtDur, hangup, nameOf, openApp, update, useNow, useS, type Call } from '../store';
import { Avatar, DialPad, Pic } from '../ui';
import { t } from '../i18n';
import { gameView } from '../gameview';
import { inGame, rpc } from '../net';
import { connect, record, type Recording } from '../rtc';

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
  const taking = c.state === 'voicemail';
  const clock = fmtDur(Math.max(0, (now - c.start) / 1000));
  const status = c.state === 'incoming' ? (c.video ? t('sys_incoming_video_call') : t('sys_mobile')) : c.state === 'outgoing' ? t('sys_calling') : taking ? `${t('sys_leave_a_message')} · ${clock}` : clock;
  const set = (patch: Partial<Call>) => update((s) => s.call && Object.assign(s.call, patch));
  const video = c.video && live;
  const remote = useRef<HTMLVideoElement>(null);
  const self = useRef<HTMLCanvasElement>(null);
  const [selfie, setSelfie] = useState(true);

  // Video calls: each phone sends its game camera to the other over WebRTC (as in LB Phone). Voices go
  // through the server's voice system, like any call. Only in-game: the demo has nobody to connect to.
  useEffect(() => {
    if (!inGame || !video) return;
    const cam = self.current && gameView(self.current);
    const hangUp = connect('call', { initiator: c.out, stream: cam?.stream(), onStream: (s) => remote.current && (remote.current.srcObject = s) });
    return () => {
      hangUp();
      cam?.destroy();
      rpc('camera', { on: false });
    };
  }, [video, c.out]);
  useEffect(() => void (inGame && video && rpc('camera', { on: true, selfie })), [video, selfie]);
  // Mute stops the other end hearing you. Speaker lets people standing near you hear the call, and the
  // phone comes away from the ear (a video call starts that way: it is held out in front, by the camera).
  useEffect(() => {
    if (!live) return;
    rpc('call.audio', { muted: c.muted, speaker: c.speaker });
    rpc('callAnim', { on: !c.speaker });
  }, [live, c.muted, c.speaker]);

  // Voicemail: nobody picked up, so the microphone is recorded until the caller hangs up (or for 30 seconds),
  // and the recording is handed to the server for the other phone.
  const take = useRef<Promise<Recording | null> | null>(null);
  const end = async () => {
    const rec = await take.current;
    take.current = null;
    if (rec) {
      const seconds = Math.max(1, Math.round((Date.now() - c.start) / 1000));
      const audio = await rec.stop();
      if (audio) await rpc('voicemail.leave', { seconds, audio });
    }
    hangup();
  };
  useEffect(() => {
    if (!taking || !inGame) return;
    take.current = record();
    take.current.then((rec) => rec || hangup());
    const limit = window.setTimeout(end, 30_000);
    return () => window.clearTimeout(limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the call turns into a voicemail
  }, [taking]);

  return (
    // Minimised, the call stays mounted (hidden) so a video connection is not dropped.
    <div className={`call ${video ? 'video' : ''}`} role="dialog" aria-label={t('sys_call_with_name', { name })} style={c.min ? { display: 'none' } : undefined}>
      {video &&
        (inGame ? (
          <>
            <video ref={remote} className="call-remote" autoPlay playsInline muted aria-label={t('sys_names_camera', { name })} />
            <canvas ref={self} className="call-self" aria-label={t('sys_your_camera')} />
          </>
        ) : (
          <>
            <Pic seed={name.length * 7 + 3} className="call-remote ugc" alt={t('sys_names_camera', { name })} />
            <Pic seed={21} className="call-self ugc" alt={t('sys_your_camera')} />
          </>
        ))}
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
                <CallBtn label={t('sys_flip')} onClick={() => setSelfie(!selfie)}>
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
              {/* In-game the other phone is asked first (it answers through the server, see call.video); the demo just switches. */}
              {live && (
                <CallBtn label={c.video ? t('sys_stop_video') : t('video')} on={c.video} onClick={() => (inGame ? void rpc('call.video', { on: !c.video }) : set({ video: !c.video }))}>
                  {c.video ? <VideoOff size={30} /> : <Video size={30} fill="currentColor" />}
                </CallBtn>
              )}
              <CallBtn label={t('contacts')} onClick={() => openApp('phone')}>
                <User size={30} fill="currentColor" />
              </CallBtn>
            </div>
          )}
          <div className="call-end">
            <button className="call-round red" aria-label={t('sys_end_call')} onClick={taking ? end : hangup}>
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
  return c ? <CallView key={c.number} c={c} /> : null;
}
