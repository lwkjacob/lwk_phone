import { useEffect, useState } from 'react';
import { Clock, Delete, Grip, Info, Mail, MessageCircle, Phone, PhoneMissed, PhoneOutgoing, Play, Plus, Star, User, Video, Voicemail as VoicemailIcon } from 'lucide-react';
import { S, alert, chatWith, confirm, contactOf, fmtAgo, fmtDur, nameOf, openApp, share, startCall, uid, update, useS } from '../store';
import { Avatar, DialPad, Empty, Field, Group, Page, Row, Search, Seg, Sheet, Tabs, useNav } from '../ui';
import { t } from '../i18n';

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
    <Sheet title={c ? t('phone_edit_contact') : t('phone_new_contact')} onClose={onClose} action={{ label: t('done'), disabled: !name.trim() || !num.trim(), run: save }}>
      <div className="contact-hero">
        <Avatar name={name || '#'} size={96} />
      </div>
      <Group>
        <Field label={t('name')} value={name} onChange={setName} placeholder={t('phone_first_and_last_name')} />
        <Field label={t('phone')} value={num} onChange={setNum} placeholder="555-0100" type="tel" />
        <Field label={t('phone_email')} value={email} onChange={setEmail} placeholder={t('name_lsmail_net')} type="email" />
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
    <Page back={t('back')} right={<button onClick={() => setEdit(true)}>{c ? t('phone_edit') : t('phone_add')}</button>}>
      <div className="contact-hero">
        <Avatar name={name} size={96} />
        <h1>{name}</h1>
        <div className="contact-acts">
          <button onClick={() => message(number)}>
            <MessageCircle size={22} fill="currentColor" strokeWidth={0} />
            {t('phone_message')}
          </button>
          <button onClick={() => startCall(number)}>
            <Phone size={22} fill="currentColor" strokeWidth={0} />
            {t('phone_call')}
          </button>
          <button onClick={() => startCall(number, true)}>
            <Video size={22} fill="currentColor" strokeWidth={0} />
            {t('phone_video')}
          </button>
          <button disabled={!c?.email} onClick={() => openApp('mail')}>
            <Mail size={22} fill="currentColor" stroke="var(--bg2)" />
            {t('phone_mail')}
          </button>
        </div>
      </div>
      {history.length > 0 && (
        <Group>
          {history.map((h) => (
            <Row key={h.id} title={h.dir === 'missed' ? t('phone_missed_call') : h.dir === 'out' ? t('phone_outgoing_call') : t('phone_incoming_call')} sub={h.dur ? fmtDur(h.dur) : undefined} value={fmtAgo(h.time)} />
          ))}
        </Group>
      )}
      <Group>
        <Row title={<small className="row-label">{t('phone_mobile')}</small>} sub={<span className="tint big">{number}</span>} onClick={() => startCall(number)} />
        {c?.email && <Row title={<small className="row-label">{t('phone_email_2')}</small>} sub={<span className="tint big">{c.email}</span>} />}
      </Group>
      <Group>
        <Row tone="tint" title={t('phone_send_message')} onClick={() => message(number)} />
        <Row tone="tint" title={t('phone_share_contact')} onClick={() => share({ kind: t('kind_contact'), label: `${name} · ${number}` })} />
        {c && <Row tone="tint" title={c.fav ? t('phone_remove_from_favorites') : t('phone_add_to_favorites')} onClick={() => update(() => (c.fav = !c.fav))} />}
        {!c && <Row tone="tint" title={t('phone_create_new_contact')} onClick={() => setEdit(true)} />}
      </Group>
      {c && (
        <Group>
          <Row tone="danger" title={c.blocked ? t('phone_unblock_caller') : t('phone_block_caller')} onClick={() => update(() => (c.blocked = !c.blocked))} />
          <Row
            tone="danger"
            title={t('phone_delete_contact')}
            onClick={() => confirm(t('phone_delete_contact'), t('phone_name_will_be_removed_from_your', { name: c.name }), t('delete'), () => (nav.pop(), update((s) => (s.contacts = s.contacts.filter((x) => x !== c)))))}
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
    <Page title={t('phone_favorites')} large>
      {favs.length ? (
        <div className="list">
          {favs.map((c) => (
            <div className="row split" key={c.id}>
              <button className="row-btn" onClick={() => startCall(c.number)}>
                <Avatar name={c.name} size={44} />
                <span className="row-main">
                  <span className="row-t">{c.name}</span>
                  <span className="row-s">
                    <Phone size={11} fill="currentColor" strokeWidth={0} />{' '}{t('phone_mobile')}
                  </span>
                </span>
              </button>
              <button className="row-info" aria-label={t('phone_name_details', { name: c.name })} onClick={() => nav.push(<ContactView number={c.number} />)}>
                <Info size={22} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon={<Star size={44} />} title={t('phone_no_favorites')} text={t('phone_add_a_contact_to_favorites_from')} />
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
    <Page title={<Seg value={filter} onChange={setFilter} options={[['all', t('phone_all')], ['missed', t('phone_missed')]] as const} />} right={list.length > 0 && <button onClick={() => confirm(t('phone_clear_all_recents'), t('phone_this_removes_your_entire_call_history'), t('phone_clear'), () => update((x) => (x.calls = [])))}>{t('phone_clear')}</button>}>
      <h1 className="lg-title">{t('phone_recents')}</h1>
      {list.length ? (
        <div className="list">
          {list.map((c) => (
            <div className="row split" key={c.id}>
              <button className="row-btn" onClick={() => startCall(c.number, c.video)}>
                <span className="row-lead dim">{c.dir === 'out' ? <PhoneOutgoing size={15} /> : c.dir === 'missed' ? <PhoneMissed size={15} /> : null}</span>
                <span className="row-main">
                  <span className={`row-t ${c.dir === 'missed' ? 'danger' : ''}`}>{nameOf(c.number)}</span>
                  <span className="row-s">{c.video ? t('video') : contactOf(c.number) ? t('phone_mobile') : t('phone_unknown')}</span>
                </span>
                <span className="row-v">{fmtAgo(c.time)}</span>
              </button>
              <button className="row-info" aria-label={t('details')} onClick={() => nav.push(<ContactView number={c.number} />)}>
                <Info size={22} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon={<Clock size={44} />} title={t('phone_no_recents')} text={filter === 'missed' ? t('phone_you_have_no_missed_calls') : t('phone_calls_you_make_and_receive_appear')} />
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
      title={t('contacts')}
      large
      right={
        <button aria-label={t('phone_add_contact')} onClick={() => setAdd(true)}>
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
            <small>{t('phone_my_card')}{' '}{s.me.number}</small>
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
                {c.blocked && <small>{' '}{t('phone_blocked')}</small>}
              </button>
            ))}
        </section>
      ))}
      {!list.length && <Empty icon={<User size={44} />} title={t('no_results')} text={t('nothing_matches_q', { q })} />}
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
        {contactOf(fmt)?.name ?? t('phone_add_number')}
      </button>
      <DialPad onKey={(k) => setNum((v) => (v + k).slice(0, 12))} />
      <div className="keypad-foot">
        <span />
        <button className="call-round green" aria-label={t('call')} disabled={!num} onClick={() => startCall(fmt)}>
          <Phone size={30} fill="currentColor" strokeWidth={0} />
        </button>
        <button aria-label={t('phone_delete_digit')} style={{ visibility: num ? 'visible' : 'hidden' }} onClick={() => setNum(num.slice(0, -1))}>
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
    <Page title={t('phone_voicemail')} large right={<button onClick={() => alert({ title: t('phone_greeting'), message: t('phone_your_callers_hear_the_default_greeting'), buttons: [{ label: t('ok'), kind: 'bold' }] })}>{t('phone_greeting')}</button>}>
      {s.voicemail.length ? (
        <div className="list">
          {s.voicemail.map((v) => (
            <div key={v.id} className={`vm ${open === v.id ? 'open' : ''}`}>
              <button className="row-btn" aria-expanded={open === v.id} onClick={() => (setOpen(open === v.id ? null : v.id), update(() => (v.heard = true)))}>
                <span className="row-lead">{!v.heard && <i className="dot" />}</span>
                <span className="row-main">
                  <span className="row-t">{nameOf(v.number)}</span>
                  <span className="row-s">{t('phone_mobile')}</span>
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
                    <button aria-label={t('play')}>
                      <Play size={20} fill="currentColor" />
                    </button>
                    <button onClick={() => startCall(v.number)}>{t('phone_call_back')}</button>
                    <button className="danger" onClick={() => update((x) => (x.voicemail = x.voicemail.filter((y) => y !== v)))}>
                      {t('delete')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty icon={<VoicemailIcon size={44} />} title={t('phone_no_voicemail')} />
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
        { id: 'favorites', label: t('phone_favorites'), icon: <Star size={24} fill="currentColor" strokeWidth={0} />, view: <Favorites /> },
        { id: 'recents', label: t('phone_recents'), icon: <Clock size={24} fill="currentColor" stroke="var(--bar-solid)" />, badge: missed, view: <Recents /> },
        { id: 'contacts', label: t('contacts'), icon: <User size={24} fill="currentColor" strokeWidth={0} />, view: <Contacts /> },
        { id: 'keypad', label: t('keypad'), icon: <Grip size={24} strokeWidth={2.6} />, view: <Keypad /> },
        { id: 'voicemail', label: t('phone_voicemail'), icon: <VoicemailIcon size={24} strokeWidth={2.4} />, badge: s.voicemail.filter((v) => !v.heard).length, view: <Voicemail /> },
      ]}
    />
  );
}
