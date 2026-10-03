import { useState } from 'react';
import { Image as ImageIcon, Megaphone, MessageCircle, Phone, Plus, Share, Tag } from 'lucide-react';
import { chatWith, confirm, fmtAgo, money, nameOf, openApp, share, startCall, uid, update, useS } from '../store';
import { Empty, Field, Group, Page, Pic, Search, Sheet, Stack, useNav } from '../ui';
import { PhotoPicker } from './Media';
import { t } from '../i18n';

type Kind = 'adverts' | 'market';

function Contact({ number }: { number: string }) {
  return (
    <div className="btn-row">
      <button className="btn" onClick={() => startCall(number)}>
        <Phone size={17} fill="currentColor" strokeWidth={0} />{' '}{t('call')}
      </button>
      <button className="btn soft" onClick={() => openApp('messages', null, { chat: chatWith(number) })}>
        <MessageCircle size={17} fill="currentColor" strokeWidth={0} />{' '}{t('message')}
      </button>
    </div>
  );
}

function NewListing({ kind, onClose }: { kind: Kind; onClose: () => void }) {
  const s = useS();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [price, setPrice] = useState('');
  const [seed, setSeed] = useState<number | undefined>();
  const [pick, setPick] = useState(false);
  const market = kind === 'market';
  const save = () => update((x) => x[kind].unshift({ id: uid(), title: title.trim(), body: body.trim(), number: s.me.number, time: Date.now(), seed, mine: true, price: market ? Number(price) : undefined }));
  return (
    <Sheet title={market ? t('listings_sell_an_item') : t('listings_new_advert')} onClose={onClose} action={{ label: t('post'), disabled: !title.trim() || (market && !(Number(price) > 0)), run: save }}>
      <Group>
        <Field label={t('title')} value={title} onChange={setTitle} placeholder={market ? t('listings_what_are_you_selling') : t('listings_headline')} />
        {market && <Field label={t('listings_price')} value={price} onChange={(v) => setPrice(v.replace(/[^\d]/g, ''))} placeholder="$0" />}
        <Field label={t('details')} value={body} onChange={setBody} area placeholder={t('listings_describe_it')} />
      </Group>
      <Group footer={t('listings_posted_with_your_number_number', { number: s.me.number })}>
        <button className="row tint" onClick={() => setPick(true)}>
          <span className="row-lead">{seed != null ? <Pic seed={seed} className="song-art" alt="" /> : <ImageIcon size={20} />}</span>
          <span className="row-main">{seed != null ? t('listings_change_photo') : t('listings_add_photo')}</span>
        </button>
      </Group>
      {pick && <PhotoPicker onPick={setSeed} onClose={() => setPick(false)} />}
    </Sheet>
  );
}

const remove = (kind: Kind, id: number, done: () => void) =>
  confirm(t('listings_remove_listing'), t('listings_this_listing_will_be_taken_down'), t('remove'), () => (done(), update((x) => (x[kind] = x[kind].filter((a) => a.id !== id)))));

/* ---------- Adverts: classifieds with a phone number ---------- */

function Adverts() {
  const s = useS();
  const [q, setQ] = useState('');
  const [add, setAdd] = useState(false);
  const list = s.adverts.filter((a) => `${a.title} ${a.body}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Page
      title={t('listings_adverts')}
      large
      right={
        <button aria-label={t('listings_new_advert_2')} onClick={() => setAdd(true)}>
          <Plus size={24} />
        </button>
      }
    >
      <Search value={q} onChange={setQ} placeholder={t('listings_search_adverts')} />
      {list.map((a) => (
        <article key={a.id} className="advert">
          {a.seed != null && <Pic seed={a.seed} className="ugc" alt="" />}
          <header>
            <h2>{a.title}</h2>
            <time>{fmtAgo(a.time)}</time>
          </header>
          <p>{a.body}</p>
          <small>
            {a.mine ? t('listings_your_advert') : nameOf(a.number)} · {a.number}
          </small>
          {a.mine ? (
            <div className="btn-row">
              <button className="btn soft danger" onClick={() => remove('adverts', a.id, () => {})}>
                {t('remove')}
              </button>
            </div>
          ) : (
            <Contact number={a.number} />
          )}
        </article>
      ))}
      {!list.length && <Empty icon={<Megaphone size={44} />} title={t('listings_no_adverts')} text={q ? t('nothing_matches_q', { q }) : t('listings_be_the_first_to_post_one')} />}
      {add && <NewListing kind="adverts" onClose={() => setAdd(false)} />}
    </Page>
  );
}

export function AdvertsApp() {
  return (
    <Stack>
      <Adverts />
    </Stack>
  );
}

/* ---------- Market: items with a price ---------- */

function Item({ id }: { id: number }) {
  const s = useS();
  const nav = useNav();
  const a = s.market.find((x) => x.id === id);
  if (!a) return null;
  return (
    <Page
      back={t('listings_market')}
      className="flush"
      right={
        <button aria-label={t('listings_share_listing')} onClick={() => share({ kind: t('kind_listing'), label: `${a.title} · ${money(a.price ?? 0, 0)}`, seed: a.seed })}>
          <Share size={22} />
        </button>
      }
    >
      <Pic seed={a.seed ?? 1} className="item-pic ugc" alt={a.title} />
      <div className="item">
        <h1>{a.title}</h1>
        <strong>{money(a.price ?? 0, 0)}</strong>
        <small>
          {t('listings_listed_ago', { ago: fmtAgo(a.time) })}{' '}{a.mine ? t('listings_you') : nameOf(a.number)}
        </small>
        <p>{a.body}</p>
        {a.mine ? (
          <div className="btn-row">
            <button className="btn soft danger" onClick={() => remove('market', a.id, nav.pop)}>
              {t('listings_mark_as_sold')}
            </button>
          </div>
        ) : (
          <Contact number={a.number} />
        )}
      </div>
    </Page>
  );
}

function Market() {
  const s = useS();
  const nav = useNav();
  const [q, setQ] = useState('');
  const [add, setAdd] = useState(false);
  const list = s.market.filter((a) => `${a.title} ${a.body}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Page
      title={t('listings_market')}
      large
      right={
        <button aria-label={t('listings_sell_an_item_2')} onClick={() => setAdd(true)}>
          <Plus size={24} />
        </button>
      }
    >
      <Search value={q} onChange={setQ} placeholder={t('listings_search_market')} />
      <div className="market">
        {list.map((a) => (
          <button key={a.id} onClick={() => nav.push(<Item id={a.id} />)}>
            <Pic seed={a.seed ?? 1} className="ugc" alt="" />
            <b>{money(a.price ?? 0, 0)}</b>
            <span>{a.title}</span>
          </button>
        ))}
      </div>
      {!list.length && <Empty icon={<Tag size={44} />} title={t('listings_no_listings')} text={q ? t('nothing_matches_q', { q }) : t('listings_tap_to_sell_something')} />}
      {add && <NewListing kind="market" onClose={() => setAdd(false)} />}
    </Page>
  );
}

export function MarketApp() {
  return (
    <Stack>
      <Market />
    </Stack>
  );
}
