import { useEffect, useState } from 'react';
import { Clock, Delete, Grip, Info, Mail, MessageCircle, Phone, PhoneMissed, PhoneOutgoing, Play, Plus, Star, User, Video, Voicemail as VoicemailIcon } from 'lucide-react';
import { S, alert, chatWith, confirm, contactOf, fmtAgo, fmtDur, nameOf, openApp, share, startCall, uid, update, useS } from '../store';
import { Avatar, DialPad, Empty, Field, Group, Page, Row, Search, Seg, Sheet, Tabs, useNav } from '../ui';

const message = (number: string) => openApp('messages', null, { chat: chatWith(number) });

export function ContactSheet({ id, number = '', onClose }: { id?: number; number?: string; onClose: () => void }) {
  const c = S.contacts.find((x) => x.id === id);
  const [name, setName] = useState(c?.name ?? '');
  const [num, setNum] = useState(c?.number ?? number);
  const [email, setEmail] = useState(c?.email ?? '');
  const save = () =>
    update((s) => {
      if (c) Object.assign(c, { name: name.trim(), number: num.trim(), email });
      else s.contacts.push({ id: uid(), name: name.trim(), number: num.trim(), email });
    });
  return (
    <Sheet title={c ? 'Edit Contact' : 'New Contact'} onClose={onClose} action={{ label: 'Done', disabled: !name.trim() || !num.trim(), run: save }}>
      <div className="contact-hero">
        <Avatar name={name || '#'} size={96} />
      </div>
      <Group>
        <Field label="Name" value={name} onChange={setName} placeholder="First and last name" />
        <Field label="Phone" value={num} onChange={setNum} placeholder="555-0100" type="tel" />
        <Field label="Email" value={email} onChange={setEmail} placeholder="name@lsmail.net" type="email" />
      </Group>
    </Sheet>
  );
}

export function ContactView({ number }: { number: string }) {
  useS();
  const nav = useNav();
  const [edit, setEdit] = useState(false);
  const c = contactOf(number);
  const name = c?.name ?? number;
  const history = S.calls.filter((x) => x.number === number).slice(0, 3);
  return (
    <Page back="Back" right={<button onClick={() => setEdit(true)}>{c ? 'Edit' : 'Add'}</button>}>
      <div className="contact-hero">
        <Avatar name={name} size={96} />
        <h1>{name}</h1>
        <div className="contact-acts">
          <button onClick={() => message(number)}>
            <MessageCircle size={22} fill="currentColor" strokeWidth={0} />
            message
          </button>
          <button onClick={() => startCall(number)}>
            <Phone size={22} fill="currentColor" strokeWidth={0} />
            call
          </button>
          <button onClick={() => startCall(number, true)}>
            <Video size={22} fill="currentColor" strokeWidth={0} />
            video
          </button>
          <button disabled={!c?.email} onClick={() => openApp('mail')}>
            <Mail size={22} fill="currentColor" stroke="var(--bg2)" />
            mail
          </button>
        </div>
      </div>
      {history.length > 0 && (
        <Group>
          {history.map((h) => (
            <Row key={h.id} title={h.dir === 'missed' ? 'Missed Call' : h.dir === 'out' ? 'Outgoing Call' : 'Incoming Call'} sub={h.dur ? fmtDur(h.dur) : undefined} value={fmtAgo(h.time)} />
          ))}
        </Group>
      )}
      <Group>
        <Row title={<small className="row-label">mobile</small>} sub={<span className="tint big">{number}</span>} onClick={() => startCall(number)} />
        {c?.email && <Row title={<small className="row-label">email</small>} sub={<span className="tint big">{c.email}</span>} />}
      </Group>
      <Group>
        <Row tone="tint" title="Send Message" onClick={() => message(number)} />
        <Row tone="tint" title="Share Contact" onClick={() => share({ kind: 'Contact', label: `${name} · ${number}` })} />
        {c && <Row tone="tint" title={c.fav ? 'Remove from Favorites' : 'Add to Favorites'} onClick={() => update(() => (c.fav = !c.fav))} />}
        {!c && <Row tone="tint" title="Create New Contact" onClick={() => setEdit(true)} />}
      </Group>
      {c && (
        <Group>
          <Row tone="danger" title={c.blocked ? 'Unblock Caller' : 'Block Caller'} onClick={() => update(() => (c.blocked = !c.blocked))} />
          <Row
            tone="danger"
            title="Delete Contact"
            onClick={() => confirm('Delete Contact', `${c.name} will be removed from your contacts.`, 'Delete', () => (nav.pop(), update((s) => (s.contacts = s.contacts.filter((x) => x !== c)))))}
          />
        </Group>
      )}
      {edit && <ContactSheet id={c?.id} number={number} onClose={() => setEdit(false)} />}
    </Page>
  );
}

function Favorites() {
  const s = useS();
  const nav = useNav();
  const favs = s.contacts.filter((c) => c.fav);
  return (
    <Page title="Favorites" large>
      {favs.length ? (
        <div className="list">
          {favs.map((c) => (
            <div className="row split" key={c.id}>
              <button className="row-btn" onClick={() => startCall(c.number)}>
                <Avatar name={c.name} size={44} />
                <span className="row-main">
                  <span className="row-t">{c.name}</span>
                  <span className="row-s">
                    <Phone size={11} fill="currentColor" strokeWidth={0} /> mobile
                  </span>
                </span>
              </button>
              <button className="row-info" aria-label={`${c.name} details`} onClick={() => nav.push(<ContactView number={c.number} />)}>
                <Info size={22} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon={<Star size={44} />} title="No Favorites" text="Add a contact to Favorites from their card." />
      )}
    </Page>
  );
}

function Recents() {
  const s = useS();
  const nav = useNav();
  const [filter, setFilter] = useState<'all' | 'missed'>('all');
  useEffect(() => update((x) => (x.seenCalls = Date.now())), []);
  const list = s.calls.filter((c) => filter === 'all' || c.dir === 'missed');
  return (
    <Page title={<Seg value={filter} onChange={setFilter} options={[['all', 'All'], ['missed', 'Missed']] as const} />} right={list.length > 0 && <button onClick={() => confirm('Clear All Recents', 'This removes your entire call history.', 'Clear', () => update((x) => (x.calls = [])))}>Clear</button>}>
      <h1 className="lg-title">Recents</h1>
      {list.length ? (
        <div className="list">
          {list.map((c) => (
            <div className="row split" key={c.id}>
              <button className="row-btn" onClick={() => startCall(c.number, c.video)}>
                <span className="row-lead dim">{c.dir === 'out' ? <PhoneOutgoing size={15} /> : c.dir === 'missed' ? <PhoneMissed size={15} /> : null}</span>
                <span className="row-main">
                  <span className={`row-t ${c.dir === 'missed' ? 'danger' : ''}`}>{nameOf(c.number)}</span>
                  <span className="row-s">{c.video ? 'Video' : contactOf(c.number) ? 'mobile' : 'unknown'}</span>
                </span>
                <span className="row-v">{fmtAgo(c.time)}</span>
              </button>
              <button className="row-info" aria-label="Details" onClick={() => nav.push(<ContactView number={c.number} />)}>
                <Info size={22} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon={<Clock size={44} />} title="No Recents" text={filter === 'missed' ? 'You have no missed calls.' : 'Calls you make and receive appear here.'} />
      )}
    </Page>
  );
}

function Contacts() {
  const s = useS();
  const nav = useNav();
  const [q, setQ] = useState('');
  const [add, setAdd] = useState(false);
  const list = s.contacts.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.number.includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  const letters = [...new Set(list.map((c) => c.name[0].toUpperCase()))];
  return (
    <Page
      title="Contacts"
      large
      right={
        <button aria-label="Add contact" onClick={() => setAdd(true)}>
          <Plus size={24} />
        </button>
      }
    >
      <Search value={q} onChange={setQ} />
      {!q && (
        <div className="me-card">
          <Avatar name={s.me.name} size={60} />
          <span>
            <b>{s.me.name}</b>
            <small>My Card · {s.me.number}</small>
          </span>
        </div>
      )}
      {letters.map((l) => (
        <section key={l} className="alpha">
          <h2>{l}</h2>
          {list
            .filter((c) => c.name[0].toUpperCase() === l)
            .map((c) => (
              <button key={c.id} onClick={() => nav.push(<ContactView number={c.number} />)}>
                {c.name}
                {c.blocked && <small> · Blocked</small>}
              </button>
            ))}
        </section>
      ))}
      {!list.length && <Empty icon={<User size={44} />} title="No Results" text={`Nothing matches “${q}”.`} />}
      {add && <ContactSheet onClose={() => setAdd(false)} />}
    </Page>
  );
}

function Keypad() {
  const [num, setNum] = useState('');
  const [add, setAdd] = useState(false);
  const fmt = num.length > 3 && !/[*#]/.test(num) ? `${num.slice(0, 3)}-${num.slice(3)}` : num;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (/^[\d*#]$/.test(e.key)) setNum((v) => (v + e.key).slice(0, 12));
      else if (e.key === 'Backspace') setNum((v) => v.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="keypad">
      <output aria-live="polite">{fmt}</output>
      <button className="keypad-add" style={{ visibility: num ? 'visible' : 'hidden' }} onClick={() => setAdd(true)}>
        {contactOf(fmt)?.name ?? 'Add Number'}
      </button>
      <DialPad onKey={(k) => setNum((v) => (v + k).slice(0, 12))} />
      <div className="keypad-foot">
        <span />
        <button className="call-round green" aria-label="Call" disabled={!num} onClick={() => startCall(fmt)}>
          <Phone size={30} fill="currentColor" strokeWidth={0} />
        </button>
        <button aria-label="Delete digit" style={{ visibility: num ? 'visible' : 'hidden' }} onClick={() => setNum(num.slice(0, -1))}>
          <Delete size={28} />
        </button>
      </div>
      {add && <ContactSheet number={fmt} onClose={() => setAdd(false)} />}
    </div>
  );
}

function Voicemail() {
  const s = useS();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Page title="Voicemail" large right={<button onClick={() => alert({ title: 'Greeting', message: 'Your callers hear the default greeting.', buttons: [{ label: 'OK', kind: 'bold' }] })}>Greeting</button>}>
      {s.voicemail.length ? (
        <div className="list">
          {s.voicemail.map((v) => (
            <div key={v.id} className={`vm ${open === v.id ? 'open' : ''}`}>
              <button className="row-btn" aria-expanded={open === v.id} onClick={() => (setOpen(open === v.id ? null : v.id), update(() => (v.heard = true)))}>
                <span className="row-lead">{!v.heard && <i className="dot" />}</span>
                <span className="row-main">
                  <span className="row-t">{nameOf(v.number)}</span>
                  <span className="row-s">mobile</span>
                </span>
                <span className="row-v">
                  {fmtAgo(v.time)}
                  <br />
                  {fmtDur(v.dur)}
                </span>
              </button>
              {open === v.id && (
                <div className="vm-body">
                  <p>“{v.text}”</p>
                  <div className="vm-acts">
                    <button aria-label="Play">
                      <Play size={20} fill="currentColor" />
                    </button>
                    <button onClick={() => startCall(v.number)}>Call Back</button>
                    <button className="danger" onClick={() => update((x) => (x.voicemail = x.voicemail.filter((y) => y !== v)))}>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty icon={<VoicemailIcon size={44} />} title="No Voicemail" />
      )}
    </Page>
  );
}

export function PhoneApp() {
  const s = useS();
  const missed = s.calls.filter((c) => c.dir === 'missed' && c.time > s.seenCalls).length;
  return (
    <Tabs
      initial="recents"
      tabs={[
        { id: 'favorites', label: 'Favorites', icon: <Star size={24} fill="currentColor" strokeWidth={0} />, view: <Favorites /> },
        { id: 'recents', label: 'Recents', icon: <Clock size={24} fill="currentColor" stroke="var(--bar-solid)" />, badge: missed, view: <Recents /> },
        { id: 'contacts', label: 'Contacts', icon: <User size={24} fill="currentColor" strokeWidth={0} />, view: <Contacts /> },
        { id: 'keypad', label: 'Keypad', icon: <Grip size={24} strokeWidth={2.6} />, view: <Keypad /> },
        { id: 'voicemail', label: 'Voicemail', icon: <VoicemailIcon size={24} strokeWidth={2.4} />, badge: s.voicemail.filter((v) => !v.heard).length, view: <Voicemail /> },
      ]}
    />
  );
}
