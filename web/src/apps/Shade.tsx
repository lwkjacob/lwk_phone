import { Ghost, Hash, Plus } from 'lucide-react';
import { sfx } from '../sound';
import { confirm, fmtAgo, preview, prompt, uid, update, useS } from '../store';
import { Bubbles, Composer, Empty, Page, Stack, useNav } from '../ui';

const ANON = ['vx', 'needle', 'anon_882', 'static', 'k0i'];
const LINES = ['who’s asking', 'not here.', 'price?', 'heard the same thing', 'delete that', 'meet at the usual spot'];

function Channel({ id }: { id: number }) {
  const s = useS();
  const nav = useNav();
  const ch = s.shade.channels.find((c) => c.id === id);
  if (!ch) return null;
  const send = (text: string) => {
    update(() => ch.msgs.push({ id: uid(), me: true, from: s.shade.alias, text, time: Date.now() }));
    sfx('sent');
    window.setTimeout(() => update(() => ch.msgs.push({ id: uid(), from: ANON[Math.floor(Math.random() * ANON.length)], text: LINES[Math.floor(Math.random() * LINES.length)], time: Date.now() })), 2600);
  };
  return (
    <Page
      className="chat"
      title={`#${ch.name}`}
      back=""
      right={
        <button className="danger" onClick={() => confirm(`Leave #${ch.name}`, 'You will stop receiving messages from this channel.', 'Leave', () => (nav.pop(), update((x) => (x.shade.channels = x.shade.channels.filter((c) => c !== ch)))))}>
          Leave
        </button>
      }
      footer={<Composer placeholder={`Message as ${s.shade.alias}`} onSend={send} />}
    >
      <Bubbles msgs={ch.msgs} who={(from) => from} empty="No messages. Nothing is logged here." />
    </Page>
  );
}

function Channels() {
  const s = useS();
  const nav = useNav();
  const join = () =>
    prompt('Join Channel', 'channel-name', (v) => {
      const name = v.toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (!name) return;
      const ch = s.shade.channels.find((c) => c.name === name) ?? { id: uid(), name, members: 1, msgs: [] };
      update((x) => x.shade.channels.includes(ch) || x.shade.channels.push(ch));
      nav.push(<Channel id={ch.id} />);
    });
  return (
    <Page
      title="Shade"
      large
      right={
        <button aria-label="Join channel" onClick={join}>
          <Plus size={24} />
        </button>
      }
    >
      <button className="shade-alias" onClick={() => prompt('Change Alias', 'alias', (v) => update((x) => (x.shade.alias = v.replace(/\s+/g, '_').toLowerCase())), s.shade.alias, 'Nobody sees your number or your name.')}>
        <Ghost size={20} />
        <span>
          <small>You appear as</small>
          <b>{s.shade.alias}</b>
        </span>
        <span className="tint">Change</span>
      </button>
      {s.shade.channels.length ? (
        <div className="list">
          {s.shade.channels.map((ch) => (
            <button key={ch.id} className="row" onClick={() => nav.push(<Channel id={ch.id} />)}>
              <span className="shade-hash">
                <Hash size={20} />
              </span>
              <span className="row-main">
                <span className="row-t">{ch.name}</span>
                <span className="row-s">{ch.msgs.length ? preview(ch.msgs[ch.msgs.length - 1]) : 'No messages'}</span>
              </span>
              <span className="row-v">
                {ch.msgs.length ? fmtAgo(ch.msgs[ch.msgs.length - 1].time) : ''}
                <br />
                {ch.members} online
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Empty icon={<Ghost size={44} />} title="No Channels" text="Tap + and enter a channel name to join." />
      )}
    </Page>
  );
}

export function ShadeApp() {
  return (
    <Stack>
      <Channels />
    </Stack>
  );
}
