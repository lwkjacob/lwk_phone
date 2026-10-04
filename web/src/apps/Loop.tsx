import { useEffect, useRef, useState } from 'react';
import { Bookmark, Heart, House, MessageCircle, Music2, Play, Plus, Share2, User, Video } from 'lucide-react';
import type { Photo } from '../data';
import { inGame } from '../net';
import { compact, send, share, uid, update, useS } from '../store';
import { Avatar, Composer, Empty, Field, Group, Page, Pic, Seg, Sheet, Tabs, useDragScroll, useNav } from '../ui';
import { FollowBtn, Handle, me, react, reply, signOut, userOf } from './social';

const ME = () => me('loop');
import { t } from '../i18n';

function CommentSheet({ id, onClose }: { id: number; onClose: () => void }) {
  const s = useS();
  const c = s.loop.find((x) => x.id === id)!;
  return (
    <Sheet title={t('loop_count_comments', { count: c.comments.length })} onClose={onClose} cancel={t('close')} fit>
      <div className="comments">
        {c.comments.map((m, i) => (
          <p key={i}>
            <Handle user={m.user} /> {m.text}
          </p>
        ))}
        {!c.comments.length && <p className="muted">{t('loop_be_the_first_to_comment')}</p>}
      </div>
      <Composer placeholder={t('loop_add_comment')} onSend={(text) => (update(() => c.comments.push({ user: ME(), text })), reply('loop', id, text))} />
    </Sheet>
  );
}

function ClipView({ id }: { id: number }) {
  const s = useS();
  const [paused, setPaused] = useState(false);
  const [comments, setComments] = useState(false);
  const c = s.loop.find((x) => x.id === id);
  const film = useRef<HTMLVideoElement>(null);
  // A real clip plays only while it is the one on screen.
  useEffect(() => {
    const v = film.current;
    if (!v) return;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting && !paused ? void v.play().catch(() => {}) : v.pause()), { threshold: 0.6 });
    io.observe(v);
    return () => io.disconnect();
  }, [paused, c?.src]);
  if (!c) return null;
  const u = userOf(c.user);
  return (
    <section className="clip">
      {c.src ? <video ref={film} className="clip-pic ugc" src={c.src} poster={typeof c.seed === 'string' ? c.seed : undefined} loop playsInline /> : <Pic seed={c.seed} className={`clip-pic ugc ${paused ? '' : 'pan'}`} alt={c.caption} />}
      <button className="clip-tap" aria-label={paused ? t('play') : t('pause')} onClick={() => setPaused(!paused)}>
        {paused && <Play size={64} fill="currentColor" strokeWidth={0} />}
      </button>
      <div className="clip-rail">
        <span className="clip-ava">
          <Avatar name={u.name} size={46} tint />
        </span>
        <button aria-label={t('like')} aria-pressed={!!c.liked} className="like" onClick={() => (update(() => ((c.liked = !c.liked), (c.likes += c.liked ? 1 : -1))), react(id, 'like', !!c.liked))}>
          <Heart size={32} fill="currentColor" strokeWidth={0} />
          {compact(c.likes)}
        </button>
        <button aria-label={t('comments')} onClick={() => setComments(true)}>
          <MessageCircle size={32} fill="currentColor" strokeWidth={0} />
          {compact(c.comments.length)}
        </button>
        <button aria-label={t('save')} aria-pressed={!!c.saved} className="save" onClick={() => (update(() => (c.saved = !c.saved)), react(id, 'save', !!c.saved))}>
          <Bookmark size={30} fill="currentColor" strokeWidth={0} />
          {t('save')}
        </button>
        <button aria-label={t('share')} onClick={() => share({ kind: t('kind_loop_video'), label: c.caption, seed: c.seed })}>
          <Share2 size={30} fill="currentColor" strokeWidth={0} />
          {compact(c.shares)}
        </button>
      </div>
      <div className="clip-info">
        <span className="clip-user">
          <Handle user={c.user} />
          <FollowBtn app="loop" user={c.user} />
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
  const list = s.loop.filter((c) => tab === 'foryou' || userOf(c.user).followed);
  return (
    <div className="loop">
      <div className="loop-top">
        <Seg value={tab} onChange={setTab} options={[['following', t('following_2')], ['foryou', t('loop_for_you')]] as const} />
      </div>
      <div className="loop-feed" ref={ref} key={tab}>
        {list.map((c) => (
          <ClipView key={c.id} id={c.id} />
        ))}
        {!list.length && <Empty icon={<Video size={44} />} title={t('loop_nothing_here_yet')} text={t('loop_follow_creators_to_fill_this_feed')} />}
      </div>
    </div>
  );
}

function Upload() {
  const s = useS();
  const [clip, setSeed] = useState<Photo | null>(null);
  const seed = clip?.id ?? null;
  const [caption, setCaption] = useState('');
  const videos = s.photos.filter((p) => p.video);
  const post = () => {
    const body = { seed: clip!.seed, src: clip!.src, caption: caption.trim() || t('loop_new_clip'), sound: `original sound · ${ME()}` };
    // In-game the server stores the clip and tells every open Loop to reload, this one included.
    if (inGame) send('post.create', { app: 'loop', body });
    else update((x) => x.loop.unshift({ id: uid(), user: ME(), ...body, likes: 0, comments: [], shares: 0 }));
    setSeed(null);
    setCaption('');
  };
  return (
    <Page
      title={t('loop_new_clip')}
      large
      right={
        <button className="bold" disabled={seed == null} onClick={post}>
          {t('post')}
        </button>
      }
    >
      <Group footer={t('loop_pick_a_video_from_your_library')}>
        <Field label={t('loop_caption')} value={caption} onChange={setCaption} placeholder={t('loop_describe_your_clip')} />
      </Group>
      {videos.length ? (
        <div className="pgrid">
          {videos.map((p) => (
            <Pic key={p.id} seed={p.seed} className={`ugc ${seed === p.id ? 'picked' : ''}`} alt={t('video')} onClick={() => setSeed(p)} />
          ))}
        </div>
      ) : (
        <Empty icon={<Video size={44} />} title={t('no_videos')} text={t('loop_record_a_video_with_camera')} />
      )}
    </Page>
  );
}

function Profile() {
  const s = useS();
  const nav = useNav();
  const [tab, setTab] = useState<'clips' | 'liked' | 'saved'>('clips');
  const u = userOf(ME());
  const list = s.loop.filter((c) => (tab === 'clips' ? c.user === ME() : tab === 'liked' ? c.liked : c.saved));
  return (
    <Page
      title={`@${ME()}`}
      right={
        inGame && (
          <button className="danger" onClick={() => signOut('loop')}>
            {t('account_sign_out')}
          </button>
        )
      }
    >
      <div className="contact-hero">
        <Avatar name={u.name} size={88} tint />
        <h1>{u.name}</h1>
        <p className="muted">
          <b>{compact(u.following)}</b>{' '}{t('following')}{' '}<b>{compact(u.followers)}</b>{' '}{t('followers')}
        </p>
      </div>
      <div className="pad-x">
        <Seg value={tab} onChange={setTab} options={[['clips', t('loop_clips')], ['liked', t('loop_liked')], ['saved', t('loop_saved')]] as const} />
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
                      {t('back')}
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
        <Empty icon={<Video size={44} />} title={t('loop_no_clips')} text={tab === 'clips' ? t('loop_post_your_first_clip_from_the') : t('loop_clips_you_mark_appear_here')} />
      )}
    </Page>
  );
}

export function LoopApp() {
  return (
    <Tabs
      tabs={[
        { id: 'home', label: t('home'), icon: <House size={24} fill="currentColor" stroke="var(--bar-solid)" />, view: <Feed /> },
        { id: 'new', label: t('loop_create'), icon: <Plus size={24} strokeWidth={3} />, view: <Upload /> },
        { id: 'me', label: t('profile'), icon: <User size={24} />, view: <Profile /> },
      ]}
    />
  );
}
