import { useState } from 'react';
import { Mail as MailIcon, Reply, SquarePen, Trash2 } from 'lucide-react';
import { fmtAgo, fmtTime, uid, update, useS } from '../store';
import { Avatar, Empty, Field, Page, Search, Seg, Sheet, Stack, useNav } from '../ui';

function Compose({ onClose, to = '', subject = '' }: { onClose: () => void; to?: string; subject?: string }) {
  const s = useS();
  const [addr, setAddr] = useState(to);
  const [sub, setSub] = useState(subject);
  const [body, setBody] = useState('');
  const send = () => update((x) => x.mail.unshift({ id: uid(), from: addr, addr, subject: sub || '(No Subject)', body, time: Date.now(), read: true, sent: true }));
  return (
    <Sheet title="New Message" onClose={onClose} action={{ label: 'Send', disabled: !/.+@.+/.test(addr), run: send }}>
      <div className="form">
        <Field label="To:" value={addr} onChange={setAddr} type="email" placeholder="name@lsmail.net" />
        <Field label="From:" value={s.me.email} onChange={() => {}} />
        <Field label="Subject:" value={sub} onChange={setSub} />
        <Field label="Message" value={body} onChange={setBody} area />
      </div>
    </Sheet>
  );
}

function MailView({ id }: { id: number }) {
  const s = useS();
  const nav = useNav();
  const [reply, setReply] = useState(false);
  const m = s.mail.find((x) => x.id === id);
  if (!m) return null;
  return (
    <Page
      back="Inbox"
      footer={
        <div className="toolbar">
          <button aria-label="Delete" onClick={() => (nav.pop(), update((x) => (x.mail = x.mail.filter((y) => y.id !== id))))}>
            <Trash2 size={22} />
          </button>
          <button aria-label="Reply" onClick={() => setReply(true)}>
            <Reply size={24} />
          </button>
        </div>
      }
    >
      <article className="mail">
        <header>
          <Avatar name={m.from} size={40} tint />
          <div>
            <b>{m.from}</b>
            <small>
              {m.sent ? 'To' : 'From'}: {m.addr}
            </small>
          </div>
          <time>{fmtTime(m.time, true)}</time>
        </header>
        <h1>{m.subject}</h1>
        <p>{m.body}</p>
      </article>
      {reply && <Compose to={m.addr} subject={`Re: ${m.subject}`} onClose={() => setReply(false)} />}
    </Page>
  );
}

function Inbox() {
  const s = useS();
  const nav = useNav();
  const [q, setQ] = useState('');
  const [box, setBox] = useState<'inbox' | 'sent'>('inbox');
  const [compose, setCompose] = useState(false);
  const list = s.mail.filter((m) => !!m.sent === (box === 'sent') && `${m.from} ${m.subject} ${m.body}`.toLowerCase().includes(q.toLowerCase()));
  const unread = s.mail.filter((m) => !m.read && !m.sent).length;
  return (
    <Page
      title={box === 'inbox' ? 'Inbox' : 'Sent'}
      large
      footer={
        <div className="toolbar">
          <span className="toolbar-note">{unread ? `${unread} Unread` : 'Updated Just Now'}</span>
          <button aria-label="Compose" onClick={() => setCompose(true)}>
            <SquarePen size={22} />
          </button>
        </div>
      }
    >
      <Search value={q} onChange={setQ} />
      <div className="pad-x">
        <Seg value={box} onChange={setBox} options={[['inbox', 'Inbox'], ['sent', 'Sent']] as const} />
      </div>
      {list.length ? (
        <div className="list convos">
          {list.map((m) => (
            <button key={m.id} className="row" onClick={() => (update(() => (m.read = true)), nav.push(<MailView id={m.id} />))}>
              <span className="convo-dot">{!m.read && <i className="dot" />}</span>
              <span className="row-main">
                <span className="convo-top">
                  <span className="row-t">{m.from}</span>
                  <time>{fmtAgo(m.time)}</time>
                </span>
                <span className="mail-sub">{m.subject}</span>
                <span className="row-s two">{m.body}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Empty icon={<MailIcon size={44} />} title="No Mail" text={q ? `Nothing matches “${q}”.` : 'This mailbox is empty.'} />
      )}
      {compose && <Compose onClose={() => setCompose(false)} />}
    </Page>
  );
}

export function MailApp() {
  return (
    <Stack>
      <Inbox />
    </Stack>
  );
}
