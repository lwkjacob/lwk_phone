import { BadgeCheck, MessageCircle } from 'lucide-react';
import { replies } from '../data';
import { sfx } from '../sound';
import { S, fmtAgo, preview, uid, update, useS } from '../store';
import { Avatar, Bubbles, Composer, Empty, Page, useNav } from '../ui';

/* Pieces shared by the social apps (Flock, Lumen, Loop). */

export const ME = 'marcus';

export function Handle({ user }: { user: string }) {
  const u = useS().users[user];
  return (
    <span className="uname">
      <b>{u?.name ?? user}</b>
      {u?.verified && <BadgeCheck size={15} className="verified" aria-label="Verified" />}
    </span>
  );
}

export function FollowBtn({ user }: { user: string }) {
  const u = useS().users[user];
  if (!u || user === ME) return null;
  return (
    <button
      className={`follow ${u.followed ? 'on' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        update(() => {
          u.followed = !u.followed;
          u.followers += u.followed ? 1 : -1;
        });
      }}
    >
      {u.followed ? 'Following' : 'Follow'}
    </button>
  );
}

type App = 'flock' | 'lumen';

export function openDM(app: App, user: string) {
  const existing = S.dms[app].find((x) => x.user === user);
  if (existing) return existing.id;
  const thread = { id: uid(), user, msgs: [] };
  update((s) => s.dms[app].unshift(thread));
  return thread.id;
}

export function DMChat({ app, id }: { app: App; id: number }) {
  const s = useS();
  const t = s.dms[app].find((x) => x.id === id);
  if (!t) return null;
  const send = (text: string) => {
    update(() => t.msgs.push({ id: uid(), me: true, text, time: Date.now() }));
    sfx('sent');
    // Mock reply so the thread feels alive.
    window.setTimeout(() => (update(() => t.msgs.push({ id: uid(), text: replies[Math.floor(Math.random() * replies.length)], time: Date.now() })), sfx('received')), 2200);
  };
  return (
    <Page className="chat" title={<Handle user={t.user} />} footer={<Composer onSend={send} />}>
      <Bubbles msgs={t.msgs} empty={`Say hi to ${s.users[t.user]?.name ?? t.user}.`} />
    </Page>
  );
}

export function DMList({ app }: { app: App }) {
  const s = useS();
  const nav = useNav();
  const list = s.dms[app];
  return (
    <Page title="Messages" large={app === 'flock'}>
      {list.length ? (
        <div className="list convos">
          {list.map((t) => (
            <button key={t.id} className="row" onClick={() => nav.push(<DMChat app={app} id={t.id} />)}>
              <Avatar name={s.users[t.user]?.name ?? t.user} size={46} tint />
              <span className="row-main">
                <span className="convo-top">
                  <Handle user={t.user} />
                  <time>{t.msgs.length ? fmtAgo(t.msgs[t.msgs.length - 1].time) : ''}</time>
                </span>
                <span className="row-s two">{preview(t.msgs[t.msgs.length - 1])}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Empty icon={<MessageCircle size={44} />} title="No Messages" text="Message someone from their profile." />
      )}
    </Page>
  );
}
