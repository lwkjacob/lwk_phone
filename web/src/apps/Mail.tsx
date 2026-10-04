import { useState } from 'react';
import { Mail as MailIcon, Reply, SquarePen, Trash2 } from 'lucide-react';
import { inGame, rpc } from '../net';
import { loadApp } from '../nui';
import { fmtAgo, fmtTime, send as request, uid, update, useS } from '../store';
import { Avatar, Empty, Field, Page, Search, Seg, Sheet, Stack, useNav } from '../ui';
import { signOut } from './social';
import { t } from '../i18n';

function Compose({ onClose, to = '', subject = '' }: { onClose: () => void; to?: string; subject?: string }) {
  const s = useS();
  const [addr, setAddr] = useState(to);
  const [sub, setSub] = useState(subject);
  const [body, setBody] = useState('');
  const send = () =>
    inGame
      ? void request('mail.send', { to: addr.trim(), subject: sub || t('mail_no_subject'), body }).then((r) => r && loadApp('mail'))
      : update((x) => x.mail.unshift({ id: uid(), from: addr, addr, subject: sub || t('mail_no_subject'), body, time: Date.now(), read: true, sent: true }));
  return (
    <Sheet title={t('new_message')} onClose={onClose} action={{ label: t('send'), disabled: !/.+@.+/.test(addr), run: send }}>
      <div className="form">
        <Field label={t('to_2')} value={addr} onChange={setAddr} type="email" placeholder={t('name_lsmail_net')} />
        <Field label={t('mail_from')} value={s.me.email} onChange={() => {}} />
        <Field label={t('mail_subject')} value={sub} onChange={setSub} />
        <Field label={t('message')} value={body} onChange={setBody} area />
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
      back={t('mail_inbox')}
      footer={
        <div className="toolbar">
          <button aria-label={t('delete')} onClick={() => (nav.pop(), rpc('mail.delete', { id }), update((x) => (x.mail = x.mail.filter((y) => y.id !== id))))}>
            <Trash2 size={22} />
          </button>
          <button aria-label={t('mail_reply')} onClick={() => setReply(true)}>
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
              {m.sent ? t('to') : t('mail_from_2')}: {m.addr}
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
      title={box === 'inbox' ? t('mail_inbox') : t('sent')}
      large
      left={inGame && <button onClick={() => signOut('mail')}>{t('account_sign_out')}</button>}
      footer={
        <div className="toolbar">
          <span className="toolbar-note">{unread ? t('mail_unread_unread', { unread }) : t('mail_updated_just_now')}</span>
          <button aria-label={t('mail_compose')} onClick={() => setCompose(true)}>
            <SquarePen size={22} />
          </button>
        </div>
      }
    >
      <Search value={q} onChange={setQ} />
      <div className="pad-x">
        <Seg value={box} onChange={setBox} options={[['inbox', t('mail_inbox')], ['sent', t('sent')]] as const} />
      </div>
      {list.length ? (
        <div className="list convos">
          {list.map((m) => (
            <button key={m.id} className="row" onClick={() => (m.read || rpc('mail.read', { id: m.id }), update(() => (m.read = true)), nav.push(<MailView id={m.id} />))}>
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
        <Empty icon={<MailIcon size={44} />} title={t('mail_no_mail')} text={q ? t('nothing_matches_q', { q }) : t('mail_this_mailbox_is_empty')} />
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
