import { useState } from 'react';
import { Bell, Feather, Heart, House, Image as ImageIcon, Mail, MessageCircle, Repeat2, Search as SearchIcon, Share, User } from 'lucide-react';
import { trends, type Seed } from '../data';
import { inGame, rpc } from '../net';
import { actions, compact, fmtAgo, prompt, send, share, uid, update, useS } from '../store';
import { Avatar, Composer, Empty, Page, Pic, Search, Sheet, Tabs, useNav } from '../ui';
import { PhotoPicker } from './Media';
import { DMChat, DMList, FollowBtn, Handle, me, react, reply, signOut, userOf } from './social';

const ME = () => me('flock');
import { t } from '../i18n';

const rich = (text: string) => text.split(/(#\w+)/).map((part, i) => (part.startsWith('#') ? <span key={i} className="tint">{part}</span> : part));

function PostCard({ id, full }: { id: number; full?: boolean }) {
  const s = useS();
  const nav = useNav();
  const p = s.flock.find((x) => x.id === id);
  if (!p) return null;
  const u = userOf(p.user);
  return (
    <article className={`post ${full ? 'full' : ''}`} onClick={full ? undefined : () => nav.push(<PostView id={id} />)}>
      <button className="post-ava" aria-label={t('flock_name_profile', { name: u.name })} onClick={(e) => (e.stopPropagation(), nav.push(<Profile user={p.user} />))}>
        <Avatar name={u.name} size={42} tint />
      </button>
      <div className="post-main">
        <header>
          <Handle user={p.user} />
          <span className="muted">
            @{p.user} · {fmtAgo(p.time)}
          </span>
        </header>
        <p>{rich(p.text)}</p>
        {p.pic != null && <Pic seed={p.pic} className="post-pic ugc" />}
        <footer onClick={(e) => e.stopPropagation()}>
          <button aria-label={t('flock_count_replies', { count: p.replies.length })} onClick={() => !full && nav.push(<PostView id={id} />)}>
            <MessageCircle size={17} /> {p.replies.length || ''}
          </button>
          <button aria-label={t('flock_repost')} aria-pressed={!!p.reposted} className="repost" onClick={() => (update(() => ((p.reposted = !p.reposted), (p.reposts += p.reposted ? 1 : -1))), react(id, 'repost', !!p.reposted))}>
            <Repeat2 size={19} /> {compact(p.reposts)}
          </button>
          <button aria-label={t('like')} aria-pressed={!!p.liked} className="like" onClick={() => (update(() => ((p.liked = !p.liked), (p.likes += p.liked ? 1 : -1))), react(id, 'like', !!p.liked))}>
            <Heart size={17} fill={p.liked ? 'currentColor' : 'none'} /> {compact(p.likes)}
          </button>
          <button aria-label={t('share')} onClick={() => share({ kind: t('kind_flock_post'), label: p.text.slice(0, 60), seed: p.pic })}>
            <Share size={17} />
          </button>
        </footer>
      </div>
    </article>
  );
}

function PostView({ id }: { id: number }) {
  const s = useS();
  const p = s.flock.find((x) => x.id === id);
  if (!p) return null;
  return (
    <Page title={t('post')} footer={<Composer placeholder={t('flock_post_your_reply')} onSend={(text) => (update(() => p.replies.push({ user: ME(), text })), reply('flock', id, text))} />}>
      <PostCard id={id} full />
      {p.replies.map((r, i) => (
        <div key={i} className="post reply">
          <Avatar name={userOf(r.user).name} size={36} tint />
          <div className="post-main">
            <header>
              <Handle user={r.user} />
              <span className="muted">@{r.user}</span>
            </header>
            <p>{rich(r.text)}</p>
          </div>
        </div>
      ))}
    </Page>
  );
}

function Profile({ user }: { user: string }) {
  const s = useS();
  const nav = useNav();
  const u = userOf(user);
  const posts = s.flock.filter((p) => p.user === user);
  const editBio = () => prompt(t('edit_bio'), t('bio'), (v) => (update(() => (u.bio = v)), rpc('profile.set', { app: 'flock', bio: v })), u.bio);
  return (
    <Page title={u.name} className="flush">
      <Pic seed={u.name.length * 9} className="banner-pic" alt="" />
      <div className="prof">
        <div className="prof-top">
          <Avatar name={u.name} size={72} tint />
          {user === ME() ? (
            <button className="follow on" onClick={() => (inGame ? actions({ options: [{ label: t('edit_bio'), run: editBio }, { label: t('account_sign_out'), destructive: true, run: () => signOut('flock') }] }) : editBio())}>
              {t('flock_edit_profile')}
            </button>
          ) : (
            <span className="prof-btns">
              <button className="follow on icon" aria-label={t('message')} onClick={() => nav.push(<DMChat app="flock" user={user} />)}>
                <Mail size={18} />
              </button>
              <FollowBtn app="flock" user={user} />
            </span>
          )}
        </div>
        <h1>
          <Handle user={user} />
        </h1>
        <span className="muted">@{user}</span>
        <p>{u.bio}</p>
        <p className="muted">
          <b>{compact(u.following)}</b>{' '}{t('following')}{' '}<b>{compact(u.followers)}</b>{' '}{t('followers')}
        </p>
      </div>
      {posts.length ? posts.map((p) => <PostCard key={p.id} id={p.id} />) : <Empty icon={<Feather size={40} />} title={t('flock_no_posts_yet')} />}
    </Page>
  );
}

function ComposeSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [pic, setPic] = useState<Seed | undefined>();
  const [pick, setPick] = useState(false);
  // In-game the server stores the post and tells every open Flock to reload, this one included.
  const post = () => (inGame ? void send('post.create', { app: 'flock', body: { text: text.trim(), pic } }) : update((s) => s.flock.unshift({ id: uid(), user: ME(), text: text.trim(), time: Date.now(), likes: 0, reposts: 0, pic, replies: [] })));
  return (
    <Sheet title={t('new_post')} onClose={onClose} action={{ label: t('post'), disabled: !text.trim() || text.length > 280, run: post }}>
      <div className="compose">
        <textarea autoFocus aria-label={t('flock_post_text')} placeholder={t('flock_whats_happening')} value={text} onChange={(e) => setText(e.target.value)} />
        {pic != null && <Pic seed={pic} className="post-pic" onClick={() => setPic(undefined)} alt={t('flock_remove_photo')} />}
        <div className="compose-bar">
          <button aria-label={t('flock_add_photo')} onClick={() => setPick(true)}>
            <ImageIcon size={22} />
          </button>
          <span className={text.length > 280 ? 'danger' : 'muted'}>{280 - text.length}</span>
        </div>
      </div>
      {pick && <PhotoPicker onPick={setPic} onClose={() => setPick(false)} />}
    </Sheet>
  );
}

function Feed() {
  const s = useS();
  const [compose, setCompose] = useState(false);
  return (
    <Page title={<Feather size={24} className="tint" fill="currentColor" />} className="flush">
      {s.flock.map((p) => (
        <PostCard key={p.id} id={p.id} />
      ))}
      <button className="fab" aria-label={t('new_post_2')} onClick={() => setCompose(true)}>
        <Feather size={24} />
      </button>
      {compose && <ComposeSheet onClose={() => setCompose(false)} />}
    </Page>
  );
}

function Explore() {
  const s = useS();
  const nav = useNav();
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const people = Object.entries(s.users).filter(([h, u]) => term && `${h} ${u.name}`.toLowerCase().includes(term));
  const posts = s.flock.filter((p) => term && p.text.toLowerCase().includes(term));
  return (
    <Page title={t('search')} large className="flush">
      <Search value={q} onChange={setQ} placeholder={t('flock_search_flock')} />
      {!term && (
        <div className="trends">
          <h2>{t('flock_trends_for_you')}</h2>
          {trends.map(([tag, n]) => (
            <button key={tag} onClick={() => setQ(tag)}>
              <small>{t('flock_trending_in_los_santos')}</small>
              <b>{tag}</b>
              <small>{n}{' '}{t('flock_posts')}</small>
            </button>
          ))}
        </div>
      )}
      {people.map(([h, u]) => (
        <button key={h} className="row" onClick={() => nav.push(<Profile user={h} />)}>
          <Avatar name={u.name} size={42} tint />
          <span className="row-main">
            <Handle user={h} />
            <span className="row-s">@{h}</span>
          </span>
          <FollowBtn app="flock" user={h} />
        </button>
      ))}
      {posts.map((p) => (
        <PostCard key={p.id} id={p.id} />
      ))}
      {term && !people.length && !posts.length && <Empty icon={<SearchIcon size={40} />} title={t('flock_no_results')} text={t('nothing_matches_q', { q })} />}
    </Page>
  );
}

function Activity() {
  const s = useS();
  const mine = s.flock.filter((p) => p.user === ME());
  // ponytail: in-game this lists replies to your posts. Likes are only counted, not attributed; store who liked to list them here.
  const items = mine.flatMap((p) => [...p.replies.filter((r) => r.user !== ME()).map((r) => ({ user: r.user, what: `replied: ${r.text}`, icon: 'reply' })), ...(inGame ? [] : [{ user: 'gia', what: `liked your post “${p.text.slice(0, 32)}”`, icon: 'like' }])]);
  return (
    <Page title={t('notifications')} large className="flush">
      {items.map((it, i) => (
        <div key={i} className="post reply">
          <Avatar name={userOf(it.user).name} size={36} tint />
          <div className="post-main">
            <p>
              <Handle user={it.user} /> {it.what}
            </p>
          </div>
          {it.icon === 'like' ? <Heart size={18} className="danger" fill="currentColor" /> : <MessageCircle size={18} className="tint" />}
        </div>
      ))}
      {!items.length && <Empty icon={<Bell size={40} />} title={t('flock_nothing_yet')} text={t('flock_likes_and_replies_show_up_here')} />}
    </Page>
  );
}

export function FlockApp() {
  return (
    <Tabs
      tabs={[
        { id: 'home', label: t('home'), icon: <House size={24} />, view: <Feed /> },
        { id: 'search', label: t('search'), icon: <SearchIcon size={24} />, view: <Explore /> },
        { id: 'activity', label: t('flock_activity'), icon: <Bell size={24} />, view: <Activity /> },
        { id: 'dms', label: t('messages'), icon: <Mail size={24} />, view: <DMList app="flock" /> },
        { id: 'me', label: t('profile'), icon: <User size={24} />, view: <Profile user={ME()} /> },
      ]}
    />
  );
}
