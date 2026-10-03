import { BadgeCheck, MessageCircle } from 'lucide-react';
import { replies } from '../data';
import { sfx } from '../sound';
import { S, fmtAgo, preview, uid, update, useS } from '../store';
import { Avatar, Bubbles, Composer, Empty, Page, useNav } from '../ui';
import { t } from '../i18n';

/* Pieces shared by the social apps (Flock, Lumen, Loop). */

export const ME = 'marcus';

export function Handle({ user }: { user: string }) {
  const u = useS().users[user];
  return (
    <span className="uname">
      <b>{u?.name ?? user}</b>
      {u?.verified && <BadgeCheck size={15} className="verified" aria-label={t('social_verified')} />}
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
      {u.followed ? t('following_2') : t('social_follow')}
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
  const th = s.dms[app].find((x) => x.id === id);
  if (!th) return null;
  const send = (text: string) => {
    update(() => th.msgs.push({ id: uid(), me: true, text, time: Date.now() }));
    sfx('sent');
    // Mock reply so the thread feels alive.
    window.setTimeout(() => (update(() => th.msgs.push({ id: uid(), text: replies[Math.floor(Math.random() * replies.length)], time: Date.now() })), sfx('received')), 2200);
  };
  return (
    <Page className="chat" title={<Handle user={th.user} />} footer={<Composer onSend={send} />}>
      <Bubbles msgs={th.msgs} empty={t('social_say_hi_to_x', { x: s.users[th.user]?.name ?? th.user })} />
    </Page>
  );
}

export function DMList({ app }: { app: App }) {
  const s = useS();
  const nav = useNav();
  const list = s.dms[app];
  return (
    <Page title={t('messages')} large={app === 'flock'}>
      {list.length ? (
        <div className="list convos">
          {list.map((th) => (
            <button key={th.id} className="row" onClick={() => nav.push(<DMChat app={app} id={th.id} />)}>
              <Avatar name={s.users[th.user]?.name ?? th.user} size={46} tint />
              <span className="row-main">
                <span className="convo-top">
                  <Handle user={th.user} />
                  <time>{th.msgs.length ? fmtAgo(th.msgs[th.msgs.length - 1].time) : ''}</time>
                </span>
                <span className="row-s two">{preview(th.msgs[th.msgs.length - 1])}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Empty icon={<MessageCircle size={44} />} title={t('no_messages')} text={t('social_message_someone_from_their_profile')} />
      )}
    </Page>
  );
}
