import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Phone, Plus, SquarePen, Video } from 'lucide-react';
import { S, actions, chatWith, confirm, contactOf, fmtAgo, fmtDur, nameOf, preview, prompt, sendMsg, startCall, uid, update, useNow, useS } from '../store';
import { Avatar, Bubbles, Composer, Empty, Group, Page, Pic, Row, Search, Sheet, Stack, Toggle, Wave, useNav } from '../ui';
import { record, type Recording } from '../rtc';
import { PhotoPicker } from './Media';
import { ContactView } from './Phone';
import { t } from '../i18n';
import { GifSheet } from '../pickers';

const titleOf = (c: { name?: string; numbers: string[] }) => c.name ?? c.numbers.map(nameOf).join(', ');

function ChatInfo({ id }: { id: number }) {
  const s = useS();
  const nav = useNav();
  const c = s.chats.find((x) => x.id === id);
  if (!c) return null;
  const group = c.numbers.length > 1;
  return (
    <Page back={t('back')}>
      <div className="contact-hero">
        <Avatar name={titleOf(c)} size={96} tint={group} />
        <h1>{titleOf(c)}</h1>
        {group && <button className="tint" onClick={() => prompt(t('messages_group_name'), t('name'), (v) => update(() => (c.name = v)), c.name)}>{t('messages_change_name')}</button>}
      </div>
      <Group header={group ? t('messages_x_people', { x: c.numbers.length + 1 }) : undefined}>
        {c.numbers.map((num) => (
          <Row key={num} icon={<Avatar name={nameOf(num)} size={36} />} title={nameOf(num)} sub={contactOf(num) ? num : undefined} chevron onClick={() => nav.push(<ContactView number={num} />)} />
        ))}
        {group && (
          <Row
            tone="tint"
            title={t('messages_add_contact')}
            onClick={() => actions({ title: t('messages_add_to_group'), options: s.contacts.filter((x) => !c.numbers.includes(x.number)).slice(0, 6).map((x) => ({ label: x.name, run: () => update(() => c.numbers.push(x.number)) })) })}
          />
        )}
      </Group>
      <Group>
        <Row title={t('messages_hide_alerts')} right={<Toggle label={t('messages_hide_alerts')} on={!!c.muted} onChange={(v) => update(() => (c.muted = v))} />} />
        <Row tone="tint" title={t('share_my_location')} onClick={() => (sendMsg(id, { loc: 'Legion Square' }), nav.pop())} />
      </Group>
      <Group>
        <Row
          tone="danger"
          title={group ? t('messages_leave_this_conversation') : t('messages_delete_conversation')}
          onClick={() => confirm(t('messages_delete_conversation'), t('messages_this_conversation_will_be_deleted_from'), t('delete'), () => (nav.pop(), nav.pop(), update((x) => (x.chats = x.chats.filter((y) => y.id !== id)))))}
        />
      </Group>
    </Page>
  );
}


function ChatView({ id }: { id: number }) {
  const s = useS();
  const nav = useNav();
  const [pick, setPick] = useState<'photo' | 'gif' | 'voice' | null>(null);
  const c = s.chats.find((x) => x.id === id);
  useEffect(() => {
    update((x) => {
      x.viewChat = id;
      const chat = x.chats.find((y) => y.id === id);
      if (chat) chat.unread = 0;
    });
    return () => update((x) => (x.viewChat = null));
  }, [id]);
  useEffect(() => {
    if (!c) nav.pop();
  }, [c, nav]);
  if (!c) return null;
  const group = c.numbers.length > 1;
  const more = () =>
    actions({
      options: [
        { label: t('messages_photo_library'), run: () => setPick('photo') },
        { label: t('gif'), run: () => setPick('gif') },
        { label: t('messages_send_location'), run: () => sendMsg(id, { loc: 'Legion Square' }) },
        { label: t('messages_voice_message'), run: () => setPick('voice') },
        ...(group ? [] : [{ label: t('send_money'), run: () => prompt(t('send_money'), t('amount'), (v) => Number(v) > 0 && sendMsg(id, { money: Math.floor(Number(v)) }), '', t('messages_to_name', { name: titleOf(c) })) }]),
      ],
    });
  return (
    <Page
      className="chat"
      back=""
      title={
        <button className="chat-head" onClick={() => nav.push(<ChatInfo id={id} />)}>
          <Avatar name={titleOf(c)} size={34} tint={group} />
          <span>{titleOf(c)}</span>
        </button>
      }
      right={
        !group && (
          <>
            <button aria-label={t('messages_video_call')} onClick={() => startCall(c.numbers[0], true)}>
              <Video size={24} />
            </button>
            <button aria-label={t('call')} onClick={() => startCall(c.numbers[0])}>
              <Phone size={21} />
            </button>
          </>
        )
      }
      footer={
        <Composer
          placeholder={t('messages_text_message')}
          onSend={(text) => sendMsg(id, { text })}
          left={
            <button type="button" className="composer-plus" aria-label={t('messages_attach')} onClick={more}>
              <Plus size={20} strokeWidth={2.6} />
            </button>
          }
        />
      }
    >
      <Bubbles msgs={c.msgs} who={group ? nameOf : undefined} typing={s.typing === id} empty={t('messages_start_the_conversation')} />
      {pick === 'photo' && <PhotoPicker onPick={(seed) => sendMsg(id, { pic: seed })} onClose={() => setPick(null)} />}
      {pick === 'voice' && <VoiceSheet onSend={(voice, audio) => sendMsg(id, { voice, audio })} onClose={() => setPick(null)} />}
      {pick === 'gif' && <GifSheet onPick={(gif) => sendMsg(id, { gif })} onClose={() => setPick(null)} />}
    </Page>
  );
}

/** Records while it is open. Send keeps the take, Cancel throws it away. */
function VoiceSheet({ onSend, onClose }: { onSend: (seconds: number, audio?: string) => void; onClose: () => void }) {
  const now = useNow(250);
  const [start] = useState(Date.now());
  const rec = useRef<Promise<Recording | null> | null>(null);
  const kept = useRef(false);
  useEffect(() => {
    rec.current = record();
    // Closing without sending: stop the microphone and drop the take.
    return () => void (kept.current || rec.current?.then((r) => r?.stop()));
  }, []);
  const send = async () => {
    kept.current = true;
    const audio = await (await rec.current)?.stop();
    onSend(Math.max(1, Math.round((Date.now() - start) / 1000)), audio);
  };
  return (
    <Sheet title={t('messages_voice_message')} onClose={onClose} action={{ label: t('send'), run: send }} fit>
      <div className="voice-rec">
        <Wave count={30} live />
        <time>{fmtDur((now - start) / 1000)}</time>
      </div>
    </Sheet>
  );
}

function NewMessage({ onClose, onOpen }: { onClose: () => void; onOpen: (id: number) => void }) {
  const s = useS();
  const [q, setQ] = useState('');
  const [to, setTo] = useState<string[]>([]);
  const list = s.contacts.filter((c) => !to.includes(c.number) && (c.name.toLowerCase().includes(q.toLowerCase()) || c.number.includes(q)));
  const start = () => {
    if (to.length === 1) return onOpen(chatWith(to[0]));
    const chat = { id: uid(), numbers: to, name: undefined, msgs: [], unread: 0 };
    update((x) => x.chats.unshift(chat));
    onOpen(chat.id);
  };
  return (
    <Sheet title={t('new_message')} onClose={onClose} action={{ label: t('next'), disabled: !to.length, run: start }}>
      <div className="to-line">
        <span>{t('to_2')}</span>
        {to.map((n) => (
          <button key={n} className="to-chip" onClick={() => setTo(to.filter((x) => x !== n))} aria-label={t('messages_remove_name', { name: nameOf(n) })}>
            {nameOf(n)}
          </button>
        ))}
        <input
          aria-label={t('messages_recipient')}
          value={q}
          placeholder={to.length ? '' : t('messages_name_or_number')}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && /^[\d-]{3,}$/.test(q) && (setTo([...to, q]), setQ(''))}
        />
      </div>
      <div className="list">
        {list.map((c) => (
          <Row key={c.id} icon={<Avatar name={c.name} size={36} />} title={c.name} sub={c.number} onClick={() => (setTo([...to, c.number]), setQ(''))} />
        ))}
      </div>
    </Sheet>
  );
}

function ChatList() {
  const s = useS();
  const nav = useNav();
  const [q, setQ] = useState('');
  const [compose, setCompose] = useState(false);
  useEffect(() => {
    // Deep link from a notification or a contact card.
    if (S.arg?.chat) nav.push(<ChatView id={Number(S.arg.chat)} />);
    S.arg = null;
  }, [nav]);
  const list = s.chats.filter((c) => titleOf(c).toLowerCase().includes(q.toLowerCase()) || c.msgs.some((x) => x.text?.toLowerCase().includes(q.toLowerCase())));
  return (
    <Page
      title={t('messages')}
      large
      right={
        <button aria-label={t('messages_new_message')} onClick={() => setCompose(true)}>
          <SquarePen size={22} />
        </button>
      }
    >
      <Search value={q} onChange={setQ} />
      {list.length ? (
        <div className="list convos">
          {list.map((c) => {
            const lastMsg = c.msgs[c.msgs.length - 1];
            return (
              <button key={c.id} className="row" onClick={() => nav.push(<ChatView id={c.id} />)}>
                <span className="convo-dot">{c.unread > 0 && <i className="dot" />}</span>
                <Avatar name={titleOf(c)} size={46} tint={c.numbers.length > 1} />
                <span className="row-main">
                  <span className="convo-top">
                    <span className="row-t">{titleOf(c)}</span>
                    <time>{lastMsg ? fmtAgo(lastMsg.time) : ''}</time>
                  </span>
                  <span className="row-s two">{s.typing === c.id ? t('messages_typing') : preview(lastMsg)}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <Empty icon={<MessageCircle size={44} />} title={q ? t('no_results') : t('no_messages')} text={q ? t('nothing_matches_q', { q }) : t('messages_tap_the_compose_button_to_start')} />
      )}
      {compose && <NewMessage onClose={() => setCompose(false)} onOpen={(id) => nav.push(<ChatView id={id} />)} />}
    </Page>
  );
}

export function MessagesApp() {
  return (
    <Stack>
      <ChatList />
    </Stack>
  );
}
