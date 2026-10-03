import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Aperture, Bookmark, Compass, Heart, House, MessageCircle, Plus, Radio, Send, User, X } from 'lucide-react';
import { compact, fmtAgo, prompt, share, uid, update, useS } from '../store';
import { Avatar, Composer, Empty, Page, Pic, Tabs, useDragScroll, useNav } from '../ui';
import { PhotoPicker } from './Media';
import { DMChat, DMList, FollowBtn, Handle, ME, openDM } from './social';

const LIVE_LINES = ['hiii', 'where is this??', 'show the car', 'first', 'that view though', 'say hi to Paleto', '🔥🔥', 'lol'];

/** Live broadcast: watch someone else's, or host your own (the game camera in FiveM). */
function Live({ user, onClose }: { user: string; onClose: () => void }) {
  const s = useS();
  const mine = user === ME;
  const [viewers, setViewers] = useState(mine ? 1 : 148);
  const [lines, setLines] = useState<{ id: number; user: string; text: string }[]>([]);
  const [hearts, setHearts] = useState<number[]>([]);
  useEffect(() => {
    const names = Object.keys(s.users).filter((h) => h !== user);
    const t = window.setInterval(() => {
      setViewers((v) => Math.max(1, v + Math.floor(Math.random() * 7) - 2));
      setLines((l) => [...l.slice(-5), { id: uid(), user: names[Math.floor(Math.random() * names.length)], text: LIVE_LINES[Math.floor(Math.random() * LIVE_LINES.length)] }]);
    }, 1600);
    return () => window.clearInterval(t);
  }, [s.users, user]);
  return (
    <div className="story live" role="dialog" aria-label={`${s.users[user].name} live`}>
      <Pic seed={mine ? 88 : 8} className="story-pic pan ugc" alt="Live video" />
      <header>
        <Avatar name={s.users[user].name} size={34} tint />
        <Handle user={user} />
        <span className="live-badge">LIVE</span>
        <span className="live-count">{compact(viewers)} watching</span>
        <button aria-label={mine ? 'End live' : 'Close'} onClick={onClose}>
          {mine ? 'End' : <X size={24} />}
        </button>
      </header>
      <div className="live-chat" aria-live="polite">
        {lines.map((l) => (
          <p key={l.id}>
            <b>{l.user}</b> {l.text}
          </p>
        ))}
      </div>
      {hearts.map((h) => (
        <Heart key={h} size={26} fill="currentColor" className="float-heart" style={{ right: 18 + (h % 5) * 6 }} />
      ))}
      <footer>
        <Composer placeholder="Comment…" onSend={(text) => setLines((l) => [...l.slice(-5), { id: uid(), user: ME, text }])} />
        <button aria-label="Send heart" onClick={() => setHearts((h) => [...h.slice(-8), uid()])}>
          <Heart size={26} />
        </button>
      </footer>
    </div>
  );
}

function StoryViewer({ start, onClose }: { start: number; onClose: () => void }) {
  const s = useS();
  const [at, setAt] = useState({ who: start, i: 0 });
  const story = s.stories[at.who];
  const next = () => {
    if (at.i + 1 < story.seeds.length) setAt({ who: at.who, i: at.i + 1 });
    else if (at.who + 1 < s.stories.length && !s.stories[at.who + 1].live) setAt({ who: at.who + 1, i: 0 });
    else onClose();
  };
  const prev = () => setAt(at.i > 0 ? { who: at.who, i: at.i - 1 } : at.who > 0 && !s.stories[at.who - 1].live ? { who: at.who - 1, i: 0 } : at);
  useEffect(() => {
    if (!story.seen) update(() => (story.seen = true));
    const t = window.setTimeout(next, 4000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart the timer per story frame only
  }, [at.who, at.i]);
  return (
    <div className="story" role="dialog" aria-label={`${s.users[story.user].name} story`}>
      <Pic seed={story.seeds[at.i]} className="story-pic ugc" alt="Story" />
      <div className="story-bars">
        {story.seeds.map((_, i) => (
          <i key={`${at.who}-${i}`} className={i < at.i ? 'done' : i === at.i ? 'run' : ''} />
        ))}
      </div>
      <header>
        <Avatar name={s.users[story.user].name} size={34} tint />
        <Handle user={story.user} />
        <button aria-label="Close" onClick={onClose}>
          <X size={24} />
        </button>
      </header>
      <button className="story-prev" aria-label="Previous" onClick={prev} />
      <button className="story-next" aria-label="Next" onClick={next} />
    </div>
  );
}

function Comments({ id }: { id: number }) {
  const s = useS();
  const g = s.lumen.find((x) => x.id === id);
  if (!g) return null;
  return (
    <Page title="Comments" footer={<Composer placeholder="Add a comment…" onSend={(text) => update(() => g.comments.push({ user: ME, text }))} />}>
      <div className="comments">
        <p>
          <Handle user={g.user} /> {g.caption}
        </p>
        {g.comments.map((c, i) => (
          <p key={i}>
            <Handle user={c.user} /> {c.text}
          </p>
        ))}
      </div>
    </Page>
  );
}

function GramCard({ id }: { id: number }) {
  const s = useS();
  const nav = useNav();
  const [pop, setPop] = useState(0);
  const g = s.lumen.find((x) => x.id === id);
  if (!g) return null;
  const like = (force?: boolean) =>
    update(() => {
      const next = force ?? !g.liked;
      if (next !== !!g.liked) g.likes += next ? 1 : -1;
      g.liked = next;
    });
  return (
    <article className="gram">
      <header>
        <button onClick={() => nav.push(<Profile user={g.user} />)}>
          <Avatar name={s.users[g.user].name} size={32} tint />
          <Handle user={g.user} />
        </button>
        <FollowBtn user={g.user} />
      </header>
      <Pic seed={g.seed} className="gram-pic ugc" alt={g.caption}>
        <span className="gram-tap" onDoubleClick={() => (like(true), setPop((n) => n + 1))} />
        {pop > 0 && <Heart key={pop} size={90} fill="#fff" strokeWidth={0} className="gram-pop" />}
      </Pic>
      <div className="gram-acts">
        <button aria-label="Like" aria-pressed={!!g.liked} className="like" onClick={() => like()}>
          <Heart size={25} fill={g.liked ? 'currentColor' : 'none'} />
        </button>
        <button aria-label="Comments" onClick={() => nav.push(<Comments id={id} />)}>
          <MessageCircle size={25} />
        </button>
        <button aria-label="Share" onClick={() => share({ kind: 'Lumen post', label: g.caption, seed: g.seed })}>
          <Send size={24} />
        </button>
        <span />
        <button aria-label="Save" aria-pressed={!!g.saved} onClick={() => update(() => (g.saved = !g.saved))}>
          <Bookmark size={25} fill={g.saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="gram-body">
        <b>{compact(g.likes)} likes</b>
        <p>
          <Handle user={g.user} /> {g.caption}
        </p>
        {g.comments.length > 0 && (
          <button className="muted" onClick={() => nav.push(<Comments id={id} />)}>
            View all {g.comments.length} comments
          </button>
        )}
        <time>{fmtAgo(g.time)}</time>
      </div>
    </article>
  );
}

function Profile({ user }: { user: string }) {
  const s = useS();
  const nav = useNav();
  const u = s.users[user];
  const posts = s.lumen.filter((g) => g.user === user);
  return (
    <Page title={<Handle user={user} />}>
      <div className="lprof">
        <Avatar name={u.name} size={80} tint />
        <span>
          <b>{posts.length}</b>Posts
        </span>
        <span>
          <b>{compact(u.followers)}</b>Followers
        </span>
        <span>
          <b>{compact(u.following)}</b>Following
        </span>
      </div>
      <p className="lprof-bio">{u.bio}</p>
      <div className="btn-row">
        {user === ME ? (
          <button className="btn soft" onClick={() => prompt('Edit Bio', 'Bio', (v) => update(() => (u.bio = v)), u.bio)}>
            Edit Profile
          </button>
        ) : (
          <>
            <FollowBtn user={user} />
            <button className="btn soft" onClick={() => nav.push(<DMChat app="lumen" id={openDM('lumen', user)} />)}>
              Message
            </button>
          </>
        )}
      </div>
      {posts.length ? (
        <div className="pgrid">
          {posts.map((g) => (
            <Pic
              key={g.id}
              seed={g.seed}
              className="ugc"
              alt={g.caption}
              onClick={() =>
                nav.push(
                  <Page title="Post">
                    <GramCard id={g.id} />
                  </Page>,
                )
              }
            />
          ))}
        </div>
      ) : (
        <Empty icon={<Aperture size={40} />} title="No Posts Yet" />
      )}
    </Page>
  );
}

function Feed() {
  const s = useS();
  const nav = useNav();
  const row = useDragScroll<HTMLDivElement>('x');
  const [story, setStory] = useState<number | null>(null);
  const [live, setLive] = useState<string | null>(null);
  const [pick, setPick] = useState(false);
  const overlay = document.getElementById('overlay');
  const post = (seed: number) => prompt('New Post', 'Write a caption…', (caption) => update((x) => x.lumen.unshift({ id: uid(), user: ME, seed, caption, time: Date.now(), likes: 0, comments: [] })));
  return (
    <Page
      className="flush"
      left={<span className="wordmark">Lumen</span>}
      right={
        <>
          <button aria-label="New post" onClick={() => setPick(true)}>
            <Plus size={26} />
          </button>
          <button aria-label="Messages" onClick={() => nav.push(<DMList app="lumen" />)}>
            <Send size={23} />
          </button>
        </>
      }
    >
      <div className="stories" ref={row}>
        <button onClick={() => setLive(ME)}>
          <span className="ring mine">
            <Avatar name={s.me.name} size={62} tint />
            <i>
              <Radio size={12} strokeWidth={3} />
            </i>
          </span>
          Go Live
        </button>
        {s.stories.map((st, i) => (
          <button key={st.user} onClick={() => (st.live ? setLive(st.user) : setStory(i))}>
            <span className={`ring ${st.seen ? 'seen' : ''} ${st.live ? 'is-live' : ''}`}>
              <Avatar name={s.users[st.user].name} size={62} tint />
              {st.live && <i className="live-badge">LIVE</i>}
            </span>
            {st.user}
          </button>
        ))}
      </div>
      {s.lumen.map((g) => (
        <GramCard key={g.id} id={g.id} />
      ))}
      {pick && <PhotoPicker onPick={post} onClose={() => setPick(false)} />}
      {overlay && story != null && createPortal(<StoryViewer start={story} onClose={() => setStory(null)} />, overlay)}
      {overlay && live && createPortal(<Live user={live} onClose={() => setLive(null)} />, overlay)}
    </Page>
  );
}

function Explore() {
  const s = useS();
  const nav = useNav();
  return (
    <Page title="Explore" large>
      <div className="pgrid">
        {s.lumen.map((g) => (
          <Pic
            key={g.id}
            seed={g.seed}
            className="ugc"
            alt={g.caption}
            onClick={() =>
              nav.push(
                <Page title="Post">
                  <GramCard id={g.id} />
                </Page>,
              )
            }
          />
        ))}
      </div>
    </Page>
  );
}

export function LumenApp() {
  return (
    <Tabs
      tabs={[
        { id: 'home', label: 'Home', icon: <House size={24} />, view: <Feed /> },
        { id: 'explore', label: 'Explore', icon: <Compass size={24} />, view: <Explore /> },
        { id: 'me', label: 'Profile', icon: <User size={24} />, view: <Profile user={ME} /> },
      ]}
    />
  );
}
