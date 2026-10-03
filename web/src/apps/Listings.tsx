import { useState } from 'react';
import { Image as ImageIcon, Megaphone, MessageCircle, Phone, Plus, Share, Tag } from 'lucide-react';
import { chatWith, confirm, fmtAgo, money, nameOf, openApp, share, startCall, uid, update, useS } from '../store';
import { Empty, Field, Group, Page, Pic, Search, Sheet, Stack, useNav } from '../ui';
import { PhotoPicker } from './Media';

type Kind = 'adverts' | 'market';

function Contact({ number }: { number: string }) {
  return (
    <div className="btn-row">
      <button className="btn" onClick={() => startCall(number)}>
        <Phone size={17} fill="currentColor" strokeWidth={0} /> Call
      </button>
      <button className="btn soft" onClick={() => openApp('messages', null, { chat: chatWith(number) })}>
        <MessageCircle size={17} fill="currentColor" strokeWidth={0} /> Message
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
    <Sheet title={market ? 'Sell an Item' : 'New Advert'} onClose={onClose} action={{ label: 'Post', disabled: !title.trim() || (market && !(Number(price) > 0)), run: save }}>
      <Group>
        <Field label="Title" value={title} onChange={setTitle} placeholder={market ? 'What are you selling?' : 'Headline'} />
        {market && <Field label="Price" value={price} onChange={(v) => setPrice(v.replace(/[^\d]/g, ''))} placeholder="$0" />}
        <Field label="Details" value={body} onChange={setBody} area placeholder="Describe it" />
      </Group>
      <Group footer={`Posted with your number, ${s.me.number}.`}>
        <button className="row tint" onClick={() => setPick(true)}>
          <span className="row-lead">{seed != null ? <Pic seed={seed} className="song-art" alt="" /> : <ImageIcon size={20} />}</span>
          <span className="row-main">{seed != null ? 'Change Photo' : 'Add Photo'}</span>
        </button>
      </Group>
      {pick && <PhotoPicker onPick={setSeed} onClose={() => setPick(false)} />}
    </Sheet>
  );
}

const remove = (kind: Kind, id: number, done: () => void) =>
  confirm('Remove Listing', 'This listing will be taken down.', 'Remove', () => (done(), update((x) => (x[kind] = x[kind].filter((a) => a.id !== id)))));

/* ---------- Adverts: classifieds with a phone number ---------- */

function Adverts() {
  const s = useS();
  const [q, setQ] = useState('');
  const [add, setAdd] = useState(false);
  const list = s.adverts.filter((a) => `${a.title} ${a.body}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Page
      title="Adverts"
      large
      right={
        <button aria-label="New advert" onClick={() => setAdd(true)}>
          <Plus size={24} />
        </button>
      }
    >
      <Search value={q} onChange={setQ} placeholder="Search adverts" />
      {list.map((a) => (
        <article key={a.id} className="advert">
          {a.seed != null && <Pic seed={a.seed} className="ugc" alt="" />}
          <header>
            <h2>{a.title}</h2>
            <time>{fmtAgo(a.time)}</time>
          </header>
          <p>{a.body}</p>
          <small>
            {a.mine ? 'Your advert' : nameOf(a.number)} · {a.number}
          </small>
          {a.mine ? (
            <div className="btn-row">
              <button className="btn soft danger" onClick={() => remove('adverts', a.id, () => {})}>
                Remove
              </button>
            </div>
          ) : (
            <Contact number={a.number} />
          )}
        </article>
      ))}
      {!list.length && <Empty icon={<Megaphone size={44} />} title="No Adverts" text={q ? `Nothing matches “${q}”.` : 'Be the first to post one.'} />}
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
      back="Market"
      className="flush"
      right={
        <button aria-label="Share listing" onClick={() => share({ kind: 'Listing', label: `${a.title} · ${money(a.price ?? 0, 0)}`, seed: a.seed })}>
          <Share size={22} />
        </button>
      }
    >
      <Pic seed={a.seed ?? 1} className="item-pic ugc" alt={a.title} />
      <div className="item">
        <h1>{a.title}</h1>
        <strong>{money(a.price ?? 0, 0)}</strong>
        <small>
          Listed {fmtAgo(a.time)} · {a.mine ? 'You' : nameOf(a.number)}
        </small>
        <p>{a.body}</p>
        {a.mine ? (
          <div className="btn-row">
            <button className="btn soft danger" onClick={() => remove('market', a.id, nav.pop)}>
              Mark as Sold
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
      title="Market"
      large
      right={
        <button aria-label="Sell an item" onClick={() => setAdd(true)}>
          <Plus size={24} />
        </button>
      }
    >
      <Search value={q} onChange={setQ} placeholder="Search Market" />
      <div className="market">
        {list.map((a) => (
          <button key={a.id} onClick={() => nav.push(<Item id={a.id} />)}>
            <Pic seed={a.seed ?? 1} className="ugc" alt="" />
            <b>{money(a.price ?? 0, 0)}</b>
            <span>{a.title}</span>
          </button>
        ))}
      </div>
      {!list.length && <Empty icon={<Tag size={44} />} title="No Listings" text={q ? `Nothing matches “${q}”.` : 'Tap + to sell something.'} />}
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
