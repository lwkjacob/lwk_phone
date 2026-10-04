import { useState, type PointerEvent as RPointerEvent } from 'react';
import { Flame, Heart, MapPin, MessageCircle, Plus, User, X } from 'lucide-react';
import { ember as ALL, replies, type Seed, type Spark } from '../data';
import { sfx } from '../sound';
import { inGame, rpc } from '../net';
import { loadApp } from '../nui';
import { S, confirm, failed, preview, prompt, uid, update, useS, view } from '../store';
import { Avatar, Bubbles, Composer, Empty, Field, Group, Page, Pic, Row, Stack, Tabs, Toggle, useDragScroll, useNav } from '../ui';
import { PhotoPicker } from './Media';
import { t } from '../i18n';

const DECK = [...ALL];
const profile = { bio: 'Mechanic. Night driver. Will fix your car, not your life.', visible: true };

/** In-game a match is known by its server key; its list position changes whenever the app reloads. */
const keyOf = (m: { id: number; key?: string }) => m.key ?? m.id;

function MatchChat({ k }: { k: string | number }) {
  const s = useS();
  const m = s.matches.find((x) => keyOf(x) === k);
  if (!m) return null;
  const send = (text: string) => {
    const msg = { id: uid(), me: true, text, time: Date.now(), failed: undefined as boolean | undefined };
    update(() => m.msgs.push(msg));
    sfx('sent');
    if (inGame) return void rpc('ember.send', { key: m.key, text }).then((r) => r?.ok || update(() => (msg.failed = true)));
    window.setTimeout(() => (update(() => m.msgs.push({ id: uid(), text: replies[Math.floor(Math.random() * replies.length)], time: Date.now() })), sfx('received')), 2400);
  };
  return (
    <Page
      className="chat"
      title={
        <span className="chat-head">
          <Avatar name={m.name} size={34} seed={m.seed} />
          <span>{m.name}</span>
        </span>
      }
      footer={<Composer onSend={send} />}
    >
      <Bubbles msgs={m.msgs} empty={t('ember_you_matched_with_name_say_something', { name: m.name })} />
    </Page>
  );
}

function Discover() {
  const s = useS();
  const nav = useNav();
  const [x, setX] = useState(0);
  const [fly, setFly] = useState(0);
  const [photo, setPhoto] = useState(0);
  const [match, setMatch] = useState<Spark | null>(null);
  const top = s.ember[0];

  const swipe = (dir: 1 | -1) => {
    if (!top || fly) return;
    setFly(dir);
    // In-game the server knows whether they liked you back.
    const answer = inGame ? rpc<{ match: boolean }>('ember.swipe', { key: top.key, like: dir > 0 }) : null;
    window.setTimeout(async () => {
      const matched = inGame ? !!(await answer)?.match : dir > 0 && !!top.likesYou;
      update((st) => {
        st.ember = st.ember.slice(1);
        if (matched && !inGame) st.matches.unshift({ id: uid(), name: top.name, seed: top.seeds[0], msgs: [] });
      });
      if (matched && inGame) await loadApp('ember');
      if (matched) (setMatch(top), sfx('notify'));
      setFly(0);
      setX(0);
      setPhoto(0);
    }, 260);
  };
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    const k = view.k;
    const sx = e.clientX;
    let dx = 0;
    const move = (m: PointerEvent) => setX((dx = (m.clientX - sx) / k));
    window.addEventListener('pointermove', move);
    window.addEventListener(
      'pointerup',
      () => {
        window.removeEventListener('pointermove', move);
        if (Math.abs(dx) > 90) swipe(dx > 0 ? 1 : -1);
        else if (Math.abs(dx) < 5) setPhoto((p) => p + 1);
        setX(0);
      },
      { once: true },
    );
  };

  if (match)
    return (
      <div className="ember-match" role="dialog" aria-label={t('ember_new_match')}>
        <h1>{t('ember_its_a_match')}</h1>
        <p>{t('ember_you_and_name_liked_each_other', { name: match.name })}</p>
        <div>
          <Avatar name={s.me.name} size={110} seed={(s.emberProfile || null)?.seeds[0] ?? 21} />
          <Avatar name={match.name} size={110} seed={match.seeds[0]} />
        </div>
        <button className="btn" onClick={() => (nav.push(<MatchChat k={match.key ?? keyOf(s.matches[0])} />), setMatch(null))}>
          {t('ember_send_a_message')}
        </button>
        <button className="btn ghost" onClick={() => setMatch(null)}>
          {t('ember_keep_swiping')}
        </button>
      </div>
    );

  return (
    <div className="ember">
      <header>
        <Flame size={26} fill="currentColor" />{' '}{t('ember_ember')}
      </header>
      <div className="ember-deck">
        {!top && (
          <Empty icon={<Flame size={48} />} title={t('ember_youre_all_caught_up')} text={t('ember_no_more_people_nearby_right_now')} />
        )}
        {s.ember
          .slice(0, 2)
          .reverse()
          .map((p) => {
            const isTop = p === top;
            const dx = isTop ? (fly ? fly * 520 : x) : 0;
            return (
              <div key={p.id} className={`ember-card ${isTop && (fly || !x) ? 'ease' : ''}`} style={{ transform: `translateX(${dx}px) rotate(${dx / 18}deg)` }} onPointerDown={isTop ? onDown : undefined}>
                <Pic seed={p.seeds[(isTop ? photo : 0) % p.seeds.length]} className="ugc" alt={t('ember_names_photo', { name: p.name })} />
                {p.seeds.length > 1 && (
                  <div className="story-bars">
                    {p.seeds.map((_, i) => (
                      <i key={i} className={isTop && i === photo % p.seeds.length ? 'done' : ''} />
                    ))}
                  </div>
                )}
                {isTop && x > 30 && <span className="stamp like">{t('ember_like')}</span>}
                {isTop && x < -30 && <span className="stamp nope">{t('ember_nope')}</span>}
                <div className="ember-info">
                  <h2>
                    {p.name} <span>{p.age}</span>
                  </h2>
                  {/* ponytail: no distance in-game. Compare player positions on the server if it is ever wanted. */}
                  <p>{inGame ? p.job : <><MapPin size={13} /> {p.dist}{' '}{t('ember_km_away')}{' '}{p.job}</>}</p>
                  <p>{p.bio}</p>
                </div>
              </div>
            );
          })}
      </div>
      <div className="ember-btns">
        {top ? (
          <>
            <button className="nope" aria-label={t('ember_pass')} onClick={() => swipe(-1)}>
              <X size={32} strokeWidth={3.4} />
            </button>
            <button className="like" aria-label={t('like')} onClick={() => swipe(1)}>
              <Heart size={30} fill="currentColor" strokeWidth={0} />
            </button>
          </>
        ) : (
          !inGame && (
            <button className="btn" onClick={() => update((st) => (st.ember = [...DECK]))}>
              {t('ember_start_over')}
            </button>
          )
        )}
      </div>
    </div>
  );
}

function Matches() {
  const s = useS();
  const nav = useNav();
  const row = useDragScroll<HTMLDivElement>('x');
  const fresh = s.matches.filter((m) => !m.msgs.length);
  const talking = s.matches.filter((m) => m.msgs.length);
  return (
    <Page title={t('ember_matches')} large>
      <h2 className="sec-h ember-tint">{t('ember_new_matches')}</h2>
      <div className="stories" ref={row}>
        {fresh.map((m) => (
          <button key={keyOf(m)} onClick={() => nav.push(<MatchChat k={keyOf(m)} />)}>
            <Avatar name={m.name} size={66} seed={m.seed} />
            {m.name}
          </button>
        ))}
        {!fresh.length && <p className="muted pad-x">{t('ember_keep_swiping_to_find_new_matches')}</p>}
      </div>
      <h2 className="sec-h ember-tint">{t('messages')}</h2>
      {talking.length ? (
        <div className="list convos">
          {talking.map((m) => (
            <button key={keyOf(m)} className="row" onClick={() => nav.push(<MatchChat k={keyOf(m)} />)}>
              <Avatar name={m.name} size={52} seed={m.seed} />
              <span className="row-main">
                <span className="row-t">{m.name}</span>
                <span className="row-s two">{preview(m.msgs[m.msgs.length - 1])}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Empty icon={<MessageCircle size={40} />} title={t('ember_no_conversations')} text={t('ember_message_a_match_to_get_things')} />
      )}
    </Page>
  );
}

function Me() {
  const s = useS();
  const mine = s.emberProfile || null;
  const bio = mine?.bio ?? profile.bio;
  const editBio = () =>
    prompt(t('edit_bio'), t('ember_about_you'), (v) => (mine ? (update(() => (mine.bio = v)), void rpc('ember.profile', { ...mine, bio: v })) : update(() => (profile.bio = v))), bio);
  const remove = () => {
    rpc('ember.delete');
    update((st) => {
      st.matches = [];
      if (inGame) (st.ember = []), (st.emberProfile = false), (st.accounts.ember = undefined);
    });
  };
  return (
    <Page title={t('profile')} large>
      <div className="contact-hero">
        <Avatar name={mine?.name ?? s.me.name} size={120} seed={mine?.seeds[0] ?? 21} />
        <h1>{mine ? `${mine.name}, ${mine.age}` : `${s.me.name.split(' ')[0]}, 28`}</h1>
        <p className="muted">{bio}</p>
      </div>
      <Group>
        <Row tone="tint" title={t('edit_bio')} onClick={editBio} />
        {!inGame && <Row title={t('ember_show_me_on_ember')} right={<Toggle label={t('ember_show_me_on_ember_2')} on={profile.visible} onChange={(v) => update(() => (profile.visible = v))} />} />}
        {!inGame && <Row title={t('ember_maximum_distance')} value={t('ember_15_km')} />}
      </Group>
      <Group>
        <Row tone="danger" title={t('ember_delete_account')} onClick={() => confirm(t('ember_delete_account'), t('ember_your_matches_and_messages_will_be'), t('delete'), remove)} />
      </Group>
    </Page>
  );
}

/** In-game, first open: a short form before anyone can see you. */
function CreateProfile() {
  const [name, setName] = useState(S.me.name.split(' ')[0]);
  const [age, setAge] = useState('');
  const [job, setJob] = useState('');
  const [bio, setBio] = useState('');
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const ok = name.trim() && Number(age) >= 18 && Number(age) <= 99;
  const create = async () => {
    setBusy(true);
    const r = await rpc<{ username: string }>('ember.profile', { name, age: Number(age), job, bio, seeds });
    setBusy(false);
    if (!r || failed(r)) return;
    update((s) => ((s.accounts.ember = r.username), delete s.loaded.ember));
    loadApp('ember');
  };
  return (
    <Page>
      <div className="contact-hero">
        <Flame size={56} fill="currentColor" className="ember-tint" />
        <h1>{t('ember_create_profile')}</h1>
        <p className="muted">{t('ember_create_profile_text')}</p>
      </div>
      <Group>
        <Field label={t('name')} value={name} onChange={setName} />
        <Field label={t('ember_age')} value={age} onChange={(v) => setAge(v.replace(/\D/g, '').slice(0, 2))} placeholder="18+" />
        <Field label={t('ember_job')} value={job} onChange={setJob} />
        <Field label={t('bio')} value={bio} onChange={setBio} area placeholder={t('ember_about_you')} />
      </Group>
      <div className="pgrid pad-x">
        {seeds.map((seed, i) => (
          <Pic key={i} seed={seed} className="ugc" alt={t('remove')} onClick={() => setSeeds(seeds.filter((_, j) => j !== i))} />
        ))}
        {seeds.length < 4 && (
          <button className="pgrid-add" aria-label={t('ember_add_photo')} onClick={() => setPick(true)}>
            <Plus size={28} />
          </button>
        )}
      </div>
      <div className="btn-row">
        <button className="btn" disabled={busy || !ok} onClick={create}>
          {t('continue')}
        </button>
      </div>
      {pick && <PhotoPicker onPick={(seed) => setSeeds([...seeds, seed])} onClose={() => setPick(false)} />}
    </Page>
  );
}

export function EmberApp() {
  const s = useS();
  if (inGame && !s.emberProfile)
    return (
      <Stack>
        <CreateProfile />
      </Stack>
    );
  return (
    <Tabs
      tabs={[
        { id: 'discover', label: t('ember_discover'), icon: <Flame size={24} fill="currentColor" />, view: <Discover /> },
        { id: 'matches', label: t('ember_matches'), icon: <MessageCircle size={24} fill="currentColor" strokeWidth={0} />, badge: s.matches.filter((m) => !m.msgs.length).length, view: <Matches /> },
        { id: 'me', label: t('profile'), icon: <User size={24} fill="currentColor" strokeWidth={0} />, view: <Me /> },
      ]}
    />
  );
}
