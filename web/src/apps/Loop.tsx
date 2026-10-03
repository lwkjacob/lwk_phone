import { useState } from 'react';
import { Bookmark, Heart, House, MessageCircle, Music2, Play, Plus, Share2, User, Video } from 'lucide-react';
import { compact, share, uid, update, useS } from '../store';
import { Avatar, Composer, Empty, Field, Group, Page, Pic, Seg, Sheet, Tabs, useDragScroll, useNav } from '../ui';
import { FollowBtn, Handle, ME } from './social';

function CommentSheet({ id, onClose }: { id: number; onClose: () => void }) {
  const s = useS();
  const c = s.loop.find((x) => x.id === id)!;
  return (
    <Sheet title={`${c.comments.length} comments`} onClose={onClose} cancel="Close" fit>
      <div className="comments">
        {c.comments.map((m, i) => (
          <p key={i}>
            <Handle user={m.user} /> {m.text}
          </p>
        ))}
        {!c.comments.length && <p className="muted">Be the first to comment.</p>}
      </div>
      <Composer placeholder="Add comment…" onSend={(text) => update(() => c.comments.push({ user: ME, text }))} />
    </Sheet>
  );
}

function ClipView({ id }: { id: number }) {
  const s = useS();
  const [paused, setPaused] = useState(false);
  const [comments, setComments] = useState(false);
  const c = s.loop.find((x) => x.id === id);
  if (!c) return null;
  const u = s.users[c.user];
  return (
    <section className="clip">
      <Pic seed={c.seed} className={`clip-pic ugc ${paused ? '' : 'pan'}`} alt={c.caption} />
      <button className="clip-tap" aria-label={paused ? 'Play' : 'Pause'} onClick={() => setPaused(!paused)}>
        {paused && <Play size={64} fill="currentColor" strokeWidth={0} />}
      </button>
      <div className="clip-rail">
        <span className="clip-ava">
          <Avatar name={u.name} size={46} tint />
        </span>
        <button aria-label="Like" aria-pressed={!!c.liked} className="like" onClick={() => update(() => ((c.liked = !c.liked), (c.likes += c.liked ? 1 : -1)))}>
          <Heart size={32} fill="currentColor" strokeWidth={0} />
          {compact(c.likes)}
        </button>
        <button aria-label="Comments" onClick={() => setComments(true)}>
          <MessageCircle size={32} fill="currentColor" strokeWidth={0} />
          {compact(c.comments.length)}
        </button>
        <button aria-label="Save" aria-pressed={!!c.saved} className="save" onClick={() => update(() => (c.saved = !c.saved))}>
          <Bookmark size={30} fill="currentColor" strokeWidth={0} />
          Save
        </button>
        <button aria-label="Share" onClick={() => share({ kind: 'Loop video', label: c.caption, seed: c.seed })}>
          <Share2 size={30} fill="currentColor" strokeWidth={0} />
          {compact(c.shares)}
        </button>
      </div>
      <div className="clip-info">
        <span className="clip-user">
          <Handle user={c.user} />
          <FollowBtn user={c.user} />
        </span>
        <p>{c.caption}</p>
        <span className="clip-sound">
          <Music2 size={13} /> {c.sound}
        </span>
      </div>
      {comments && <CommentSheet id={id} onClose={() => setComments(false)} />}
    </section>
  );
}

function Feed() {
  const s = useS();
  const ref = useDragScroll<HTMLDivElement>('y', true);
  const [tab, setTab] = useState<'following' | 'foryou'>('foryou');
  const list = s.loop.filter((c) => tab === 'foryou' || s.users[c.user].followed);
  return (
    <div className="loop">
      <div className="loop-top">
        <Seg value={tab} onChange={setTab} options={[['following', 'Following'], ['foryou', 'For You']] as const} />
      </div>
      <div className="loop-feed" ref={ref} key={tab}>
        {list.map((c) => (
          <ClipView key={c.id} id={c.id} />
        ))}
        {!list.length && <Empty icon={<Video size={44} />} title="Nothing here yet" text="Follow creators to fill this feed." />}
      </div>
    </div>
  );
}

function Upload() {
  const s = useS();
  const [seed, setSeed] = useState<number | null>(null);
  const [caption, setCaption] = useState('');
  const videos = s.photos.filter((p) => p.video);
  const post = () => {
    update((x) => x.loop.unshift({ id: uid(), user: ME, seed: seed!, caption: caption.trim() || 'New clip', sound: `original sound · ${ME}`, likes: 0, comments: [], shares: 0 }));
    setSeed(null);
    setCaption('');
  };
  return (
    <Page
      title="New Clip"
      large
      right={
        <button className="bold" disabled={seed == null} onClick={post}>
          Post
        </button>
      }
    >
      <Group footer="Pick a video from your library. Record one in Camera first if this is empty.">
        <Field label="Caption" value={caption} onChange={setCaption} placeholder="Describe your clip" />
      </Group>
      {videos.length ? (
        <div className="pgrid">
          {videos.map((p) => (
            <Pic key={p.id} seed={p.seed} className={`ugc ${seed === p.seed ? 'picked' : ''}`} alt="Video" onClick={() => setSeed(p.seed)} />
          ))}
        </div>
      ) : (
        <Empty icon={<Video size={44} />} title="No Videos" text="Record a video with Camera." />
      )}
    </Page>
  );
}

function Profile() {
  const s = useS();
  const nav = useNav();
  const [tab, setTab] = useState<'clips' | 'liked' | 'saved'>('clips');
  const u = s.users[ME];
  const list = s.loop.filter((c) => (tab === 'clips' ? c.user === ME : tab === 'liked' ? c.liked : c.saved));
  return (
    <Page title={`@${ME}`}>
      <div className="contact-hero">
        <Avatar name={u.name} size={88} tint />
        <h1>{u.name}</h1>
        <p className="muted">
          <b>{compact(u.following)}</b> Following · <b>{compact(u.followers)}</b> Followers
        </p>
      </div>
      <div className="pad-x">
        <Seg value={tab} onChange={setTab} options={[['clips', 'Clips'], ['liked', 'Liked'], ['saved', 'Saved']] as const} />
      </div>
      {list.length ? (
        <div className="pgrid tall">
          {list.map((c) => (
            <Pic
              key={c.id}
              seed={c.seed}
              className="ugc"
              alt={c.caption}
              onClick={() =>
                nav.push(
                  <div className="loop">
                    <button className="loop-back" onClick={nav.pop}>
                      Back
                    </button>
                    <ClipView id={c.id} />
                  </div>,
                )
              }
            >
              <span className="thumb-dur">
                <Play size={10} fill="currentColor" /> {compact(c.likes)}
              </span>
            </Pic>
          ))}
        </div>
      ) : (
        <Empty icon={<Video size={44} />} title="No clips" text={tab === 'clips' ? 'Post your first clip from the + tab.' : 'Clips you mark appear here.'} />
      )}
    </Page>
  );
}

export function LoopApp() {
  return (
    <Tabs
      tabs={[
        { id: 'home', label: 'Home', icon: <House size={24} fill="currentColor" stroke="var(--bar-solid)" />, view: <Feed /> },
        { id: 'new', label: 'Create', icon: <Plus size={24} strokeWidth={3} />, view: <Upload /> },
        { id: 'me', label: 'Profile', icon: <User size={24} />, view: <Profile /> },
      ]}
    />
  );
}
