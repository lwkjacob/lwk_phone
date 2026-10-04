import { useState, type ComponentType } from 'react';
import { BadgeCheck, MessageCircle } from 'lucide-react';
import { replies, type User } from '../data';
import { sfx } from '../sound';
import { S, confirm, failed, fmtAgo, preview, uid, update, useS } from '../store';
import { inGame, rpc } from '../net';
import { loadApp } from '../nui';
import { Avatar, Bubbles, Composer, Empty, Field, Group, Page, Stack, useNav } from '../ui';
import { APPS, AppIcon } from './index';
import { t } from '../i18n';

/* Pieces shared by the social apps (Flock, Lumen, Loop, Shade, Mail). */

/** The account this phone is signed in to in `app`. The browser demo is always marcus. */
export const me = (app: string) => (inGame ? (S.accounts[app] ?? '') : 'marcus');

/** A user's profile, or a stand-in while theirs is still on its way from the server. */
export const userOf = (user: string): User => S.users[user] ?? { name: user, bio: '', followers: 0, following: 0 };

/* ---------- accounts ---------- */

type AccountApp = 'flock' | 'lumen' | 'loop' | 'shade' | 'mail';

function SignIn({ app }: { app: AccountApp }) {
  const [create, setCreate] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  // Shade is anonymous and Mail shows the address, so neither asks for a display name.
  const named = create && app !== 'shade' && app !== 'mail';
  const submit = async () => {
    setBusy(true);
    const r = await rpc<{ username: string }>(create ? 'account.signup' : 'account.login', { app, username, password, name });
    setBusy(false);
    if (!r || failed(r)) return;
    update((s) => {
      s.accounts[app] = r.username;
      if (app === 'mail') s.me.email = `${r.username}@${s.cfg.mailDomain}`;
      delete s.loaded[app];
    });
    loadApp(app);
  };
  return (
    <Page>
      <div className="contact-hero">
        <AppIcon id={app} size={76} />
        <h1>{APPS[app].name}</h1>
        <p className="muted">{create ? t('account_create_text') : t('account_sign_in_text')}</p>
      </div>
      <Group footer={create ? t('account_username_hint') : undefined}>
        <Field label={t('account_username')} value={username} onChange={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))} />
        <Field label={t('account_password')} value={password} onChange={setPassword} type="password" />
        {named && <Field label={t('name')} value={name} onChange={setName} placeholder={t('account_display_name')} />}
      </Group>
      <div className="btn-row">
        <button className="btn" disabled={busy || username.length < 3 || password.length < 4} onClick={submit}>
          {create ? t('account_create') : t('account_sign_in')}
        </button>
      </div>
      <div className="btn-row">
        <button className="btn soft" onClick={() => setCreate(!create)}>
          {create ? t('account_have_one') : t('account_create')}
        </button>
      </div>
    </Page>
  );
}

/** In-game, an app that needs an account shows the sign-in screen until this phone is signed in. */
export function gated(app: AccountApp, View: ComponentType): ComponentType {
  return function Gated() {
    const s = useS();
    if (!inGame || s.accounts[app]) return <View />;
    return (
      <Stack>
        <SignIn app={app} />
      </Stack>
    );
  };
}

/** Sign this phone out of `app`. The account stays, and can be signed in to again from any phone. */
export const signOut = (app: AccountApp) =>
  confirm(t('account_sign_out'), t('account_sign_out_text'), t('account_sign_out'), () => {
    rpc('account.logout', { app });
    update((s) => {
      s.accounts[app] = undefined;
      if (app === 'mail') s.me.email = '';
    });
  });

/* ---------- people ---------- */

export function Handle({ user }: { user: string }) {
  const u = useS().users[user];
  return (
    <span className="uname">
      <b>{u?.name ?? user}</b>
      {u?.verified && <BadgeCheck size={15} className="verified" aria-label={t('social_verified')} />}
    </span>
  );
}

type FeedApp = 'flock' | 'lumen' | 'loop';

export function FollowBtn({ app, user }: { app: FeedApp; user: string }) {
  const u = useS().users[user];
  if (!u || user === me(app)) return null;
  return (
    <button
      className={`follow ${u.followed ? 'on' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        update(() => {
          u.followed = !u.followed;
          u.followers += u.followed ? 1 : -1;
        });
        rpc('follow', { app, user, on: !!u.followed });
      }}
    >
      {u.followed ? t('following_2') : t('social_follow')}
    </button>
  );
}

/** Posts, replies and reactions share one shape on the server: see post.create and post.react in server/social.lua. */
export const react = (id: number, kind: 'like' | 'repost' | 'save', on: boolean) => void rpc('post.react', { id, kind, on });
export const reply = (app: FeedApp, parent: number, text: string) => void rpc('post.create', { app, parent, body: { text } });

/* ---------- direct messages ---------- */

type App = 'flock' | 'lumen';

/** A thread is found by who it is with, not by id: the server hands out new ids when the app reloads. */
export function DMChat({ app, user }: { app: App; user: string }) {
  const s = useS();
  const th = s.dms[app].find((x) => x.user === user);
  const send = (text: string) => {
    const msg = { id: uid(), me: true, text, time: Date.now(), failed: undefined as boolean | undefined };
    update((x) => {
      const thread = x.dms[app].find((y) => y.user === user);
      if (thread) thread.msgs.push(msg);
      else x.dms[app].unshift({ id: uid(), user, msgs: [msg] });
    });
    sfx('sent');
    if (inGame) return void rpc('dm.send', { app, to: user, body: { text } }).then((r) => r?.ok || update(() => (msg.failed = true)));
    // Mock reply so the thread feels alive.
    window.setTimeout(() => (update((x) => x.dms[app].find((y) => y.user === user)?.msgs.push({ id: uid(), text: replies[Math.floor(Math.random() * replies.length)], time: Date.now() })), sfx('received')), 2200);
  };
  return (
    <Page className="chat" title={<Handle user={user} />} footer={<Composer onSend={send} />}>
      <Bubbles msgs={th?.msgs ?? []} empty={t('social_say_hi_to_x', { x: s.users[user]?.name ?? user })} />
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
            <button key={th.id} className="row" onClick={() => nav.push(<DMChat app={app} user={th.user} />)}>
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
