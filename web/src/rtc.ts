import { nuiFetch } from './nui';

/* Audio and video between players travel over WebRTC, the way LB Phone does it: video calls,
 * live streams, and recording nearby voices. The game only relays the handshake ("signals");
 * the media itself goes player to player, or through a TURN server when a direct route fails.
 *
 * Game side still to write: relay `rtc` posts to the other player as { action = 'rtc', from, signal },
 * and send { action = 'rtcConfig', config } with the server's ICE/TURN servers (LB: Config.RTCConfig). */

/** ICE servers. Empty works on a LAN; real servers need STUN and usually TURN, supplied by the game. */
let config: RTCConfiguration = { iceServers: [] };
export const setRtcConfig = (c: RTCConfiguration) => (config = c);

export type Signal = { sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit };
type Peer = { pc: RTCPeerConnection; send: (s: Signal) => void; pending: RTCIceCandidateInit[] };
const peers = new Map<string, Peer>();

/**
 * Open a connection to another player. The caller is the initiator; the other side just connects and waits.
 * `send` carries our signals to them (default: through the game); theirs come back in through `signal`.
 */
export function connect(id: string, opts: { initiator: boolean; stream?: MediaStream; onStream: (s: MediaStream) => void; send?: (s: Signal) => void }) {
  const send = opts.send ?? ((signal: Signal) => void nuiFetch(null, 'rtc', { to: id, signal }));
  const pc = new RTCPeerConnection(config);
  peers.set(id, { pc, send, pending: [] });
  if (opts.stream) opts.stream.getTracks().forEach((track) => pc.addTrack(track, opts.stream!));
  // Nothing to send still means we want to hear them.
  else pc.addTransceiver('audio', { direction: 'recvonly' });
  pc.onicecandidate = (e) => e.candidate && send({ ice: e.candidate.toJSON() });
  pc.ontrack = (e) => opts.onStream(e.streams[0] ?? new MediaStream([e.track]));
  if (opts.initiator)
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => send({ sdp: pc.localDescription! }))
      .catch((err) => console.warn('[phone] rtc offer failed', err));
  return () => disconnect(id);
}

export function disconnect(id: string) {
  peers.get(id)?.pc.close();
  peers.delete(id);
}

/** Feed in a signal that arrived from the other player. */
export async function signal(id: string, s: Signal) {
  const peer = peers.get(id);
  if (!peer) return;
  const { pc } = peer;
  if (s.sdp) {
    await pc.setRemoteDescription(s.sdp);
    // Candidates can outrun the description they belong to; apply the ones that were waiting.
    for (const ice of peer.pending.splice(0)) await pc.addIceCandidate(ice);
    if (s.sdp.type === 'offer') {
      await pc.setLocalDescription(await pc.createAnswer());
      peer.send({ sdp: pc.localDescription! });
    }
  } else if (s.ice) {
    if (pc.remoteDescription) await pc.addIceCandidate(s.ice);
    else peer.pending.push(s.ice);
  }
}

/**
 * Self-check: two connections inside this page, wired to each other, carrying a generated tone.
 * Proves the handshake and media path without a second player. Resolves true when audio arrives.
 */
export function loopbackTest(timeout = 6000): Promise<boolean> {
  return new Promise((resolve) => {
    const ac = new AudioContext();
    const tone = ac.createOscillator();
    const out = ac.createMediaStreamDestination();
    tone.connect(out);
    tone.start();
    const done = (ok: boolean) => {
      window.clearTimeout(timer);
      disconnect('loop-a');
      disconnect('loop-b');
      tone.stop();
      ac.close();
      resolve(ok);
    };
    const timer = window.setTimeout(() => done(false), timeout);
    connect('loop-b', { initiator: false, send: (s) => void signal('loop-a', s), onStream: (s) => done(s.getAudioTracks().length > 0) });
    connect('loop-a', { initiator: true, stream: out.stream, send: (s) => void signal('loop-b', s), onStream: () => {} });
  });
}

/* ---------- microphone recording (voice memos, voice messages) ---------- */

export type Recording = { stop: () => Promise<string> };

/** Start recording the microphone. Null when there is no microphone or permission was refused. */
export async function record(): Promise<Recording | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.start();
    return {
      stop: () =>
        new Promise((resolve) => {
          rec.onstop = () => {
            stream.getTracks().forEach((track) => track.stop());
            // ponytail: a local blob URL only plays on this phone. Upload it (LB: components.uploadMedia) once hosting exists.
            resolve(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })));
          };
          rec.stop();
        }),
    };
  } catch {
    return null;
  }
}
