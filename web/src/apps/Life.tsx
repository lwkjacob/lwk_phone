import { useState } from 'react';
import { Ambulance, Briefcase, Building2, Car, DoorClosed, DoorOpen, KeyRound, Lightbulb, MapPin, MessageCircle, Phone, Scale, Shield, Wrench } from 'lucide-react';
import { services } from '../data';
import { S, actions, alert, chatWith, confirm, fmtAgo, money, nameOf, notify, openApp, pay, prompt, share, startCall, update, useS } from '../store';
import { Avatar, Field, Group, Page, Pic, Row, Seg, Sheet, Stack, Tabs, Toggle, useNav } from '../ui';
import { t } from '../i18n';

/* ---------- Wallet ---------- */

function MoneySheet({ onClose }: { onClose: () => void }) {
  const s = useS();
  const [mode, setMode] = useState<'send' | 'request'>('send');
  const [to, setTo] = useState(s.contacts[0]?.number ?? '');
  const [amount, setAmount] = useState('');
  const v = Math.floor(Number(amount));
  const run = () => {
    if (mode === 'request') return notify({ app: 'wallet', title: t('life_request_sent'), body: t('life_name_was_asked_for_amount', { name: nameOf(to), amount: money(v, 0) }) });
    if (v > S.wallet.balance) return alert({ title: t('insufficient_funds'), message: t('your_balance_is_too_low_for'), buttons: [{ label: t('ok'), kind: 'bold' }] });
    pay(-v, nameOf(to));
  };
  return (
    <Sheet title={mode === 'send' ? t('send_money') : t('life_request_money')} onClose={onClose} action={{ label: mode === 'send' ? t('send') : t('life_request'), disabled: !(v > 0) || !to, run }}>
      <div className="pad-x">
        <Seg value={mode} onChange={setMode} options={[['send', t('send')], ['request', t('life_request')]] as const} />
      </div>
      <Group>
        <Field label={t('amount')} value={amount} onChange={(x) => setAmount(x.replace(/[^\d]/g, ''))} placeholder="$0" />
      </Group>
      <Group header={t('to')}>
        {s.contacts.map((c) => (
          <Row key={c.id} icon={<Avatar name={c.name} size={32} />} title={c.name} sub={c.number} onClick={() => setTo(c.number)} value={to === c.number ? '✓' : undefined} />
        ))}
      </Group>
    </Sheet>
  );
}

export function WalletApp() {
  const s = useS();
  const [sheet, setSheet] = useState(false);
  return (
    <Stack>
      <Page title={t('life_wallet')} large>
        <div className="cards">
          <div className="bank-card">
            <span className="bank-brand">
              {t('life_lwk')}{' '}<small>{t('life_bank')}</small>
            </span>
            <i className="bank-chip" />
            <span className="bank-num">•••• •••• •••• 4118</span>
            <span className="bank-name">{s.me.name}</span>
            <b>{t('life_debit')}</b>
          </div>
          <div className="id-card">
            <span>{t('life_san_andreas_driver_licence')}</span>
            <Avatar name={s.me.name} size={52} />
            <b>{s.me.name}</b>
            <small>{t('life_class_c_dl_48_20_4118')}</small>
          </div>
        </div>
        <div className="balance">
          <small>{t('life_balance')}</small>
          <strong>{money(s.wallet.balance)}</strong>
          <span>
            {t('life_cash_amount', { amount: money(s.wallet.cash, 0) })}{' '}{s.wallet.iban}
          </span>
        </div>
        <div className="btn-row">
          <button className="btn" onClick={() => setSheet(true)}>
            {t('life_send_or_request')}
          </button>
        </div>
        <Group header={t('life_latest_transactions')}>
          {s.wallet.txs.map((t) => (
            <Row key={t.id} icon={<Avatar name={t.label} size={36} tint />} title={t.label} sub={fmtAgo(t.time)} value={<span className={t.amount > 0 ? 'pos' : ''}>{`${t.amount > 0 ? '+' : ''}${money(t.amount)}`}</span>} />
          ))}
        </Group>
        {sheet && <MoneySheet onClose={() => setSheet(false)} />}
      </Page>
    </Stack>
  );
}

/* ---------- Home ---------- */

const waypoint = (name: string) => notify({ app: 'maps', title: t('waypoint_set'), body: t('route_to_name_is_on_your', { name }) });

function HouseView({ id }: { id: number }) {
  const s = useS();
  const h = s.houses.find((x) => x.id === id);
  if (!h) return null;
  return (
    <Page title={h.name} back={t('home')}>
      <Pic seed={h.seed} className="house-cover" alt={h.name} />
      <div className="tiles">
        <button aria-pressed={!h.locked} onClick={() => update(() => (h.locked = !h.locked))}>
          {h.locked ? <DoorClosed size={26} /> : <DoorOpen size={26} />}
          <b>{t('life_front_door')}</b>
          <small>{h.locked ? t('life_locked') : t('life_unlocked')}</small>
        </button>
        <button aria-pressed={h.lights} onClick={() => update(() => (h.lights = !h.lights))}>
          <Lightbulb size={26} fill={h.lights ? 'currentColor' : 'none'} />
          <b>{t('life_lights')}</b>
          <small>{h.lights ? t('on') : t('off')}</small>
        </button>
      </div>
      <Group header={t('life_keys')} footer={t('life_key_holders_can_enter_this_property')}>
        {h.keys.map((num) => (
          <Row
            key={num}
            icon={<Avatar name={nameOf(num)} size={32} />}
            title={nameOf(num)}
            right={
              <button className="danger" onClick={() => update(() => (h.keys = h.keys.filter((k) => k !== num)))}>
                {t('life_revoke')}
              </button>
            }
          />
        ))}
        <Row
          tone="tint"
          icon={<KeyRound size={20} />}
          title={t('life_give_key')}
          onClick={() => actions({ title: t('life_give_a_key_to'), options: s.contacts.filter((c) => !h.keys.includes(c.number)).slice(0, 6).map((c) => ({ label: c.name, run: () => update(() => h.keys.push(c.number)) })) })}
        />
      </Group>
      <Group>
        <Row tone="tint" title={t('set_waypoint')} onClick={() => waypoint(h.name)} />
        <Row tone="tint" title={t('life_share_address')} onClick={() => share({ kind: t('kind_location'), label: `${h.name} · ${h.addr}` })} />
      </Group>
    </Page>
  );
}

function Houses() {
  const s = useS();
  const nav = useNav();
  return (
    <Page title={t('home')} large>
      <div className="house-list">
        {s.houses.map((h) => (
          <button key={h.id} onClick={() => nav.push(<HouseView id={h.id} />)}>
            <Pic seed={h.seed} />
            <span>
              <b>{h.name}</b>
              <small>{h.addr}</small>
            </span>
            <span className={`pill ${h.locked ? '' : 'warn'}`}>{h.locked ? t('life_locked') : t('life_unlocked')}</span>
          </button>
        ))}
      </div>
    </Page>
  );
}

export function HomeApp() {
  return (
    <Stack>
      <Houses />
    </Stack>
  );
}

/* ---------- Garage ---------- */

/** [locale key, pill colour] */
const STATE = { out: ['life_state_out', 'ok'], garaged: ['life_state_garaged', ''], impound: ['life_state_impound', 'bad'] } as const;

/** A side-on car in the vehicle's paint colour. In-game this slot takes the vehicle's real image. */
function CarArt({ color, width }: { color: string; width: number }) {
  return (
    <svg width={width} height={width * 0.375} viewBox="0 0 240 90" aria-hidden="true">
      <ellipse cx="120" cy="82" rx="104" ry="5" fill="rgba(0, 0, 0, 0.28)" />
      <path d="M14 62c0-8 6-13 16-15l26-4c10-13 24-21 44-21h36c18 0 32 7 44 20l28 5c10 2 18 7 18 16v6c0 3-2 5-5 5H19c-3 0-5-2-5-5Z" fill={color} />
      <path d="M14 62c0-8 6-13 16-15l26-4c10-13 24-21 44-21h36c18 0 32 7 44 20l28 5c10 2 18 7 18 16v6c0 3-2 5-5 5H19c-3 0-5-2-5-5Z" fill="url(#car-shade)" />
      <path d="M66 43c8-10 19-15 34-15h14v15Zm56-15h14c13 0 24 5 33 15h-47Z" fill="rgba(10, 14, 20, 0.78)" />
      <rect x="207" y="52" width="16" height="5" rx="2.5" fill="#fff" opacity="0.85" />
      <rect x="15" y="54" width="11" height="5" rx="2.5" fill="#ff453a" />
      {[62, 182].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="69" r="15" fill="#0c0c0e" />
          <circle cx={cx} cy="69" r="8" fill="#8c9199" />
          <circle cx={cx} cy="69" r="3" fill="#2a2c30" />
        </g>
      ))}
      <defs>
        <linearGradient id="car-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.3" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="meter">
      <span>{label}</span>
      <i>
        <i className={value < 35 ? 'low' : ''} style={{ width: `${value}%` }} />
      </i>
      <b>{value}%</b>
    </div>
  );
}

function VehicleView({ id }: { id: number }) {
  const s = useS();
  const v = s.vehicles.find((x) => x.id === id);
  if (!v) return null;
  const impound = v.state === 'impound';
  const fee = impound ? 250 : 100;
  const bring = () =>
    confirm(impound ? t('life_pay_impound_fee') : t('life_request_valet'), t('life_amount_will_be_charged_to_your', { amount: money(fee, 0) }), t('life_pay'), () => {
      if (fee > S.wallet.balance) return alert({ title: t('insufficient_funds'), buttons: [{ label: t('ok'), kind: 'bold' }] });
      pay(-fee, impound ? 'Impound fee' : 'Valet service');
      update(() => (v.state = 'out'));
      notify({ app: 'garage', title: v.name, body: impound ? t('life_released_from_impound') : t('life_your_valet_is_on_the_way') });
    });
  return (
    <Page title={v.name} back={t('life_garage')}>
      <div className="car-hero">
        <CarArt color={v.color} width={270} />
        <span className="plate">{v.plate}</span>
      </div>
      <Group>
        <Row title={t('life_status')} right={<span className={`pill ${STATE[v.state][1]}`}>{t(STATE[v.state][0])}</span>} />
        <Row title={t('life_location')} value={v.garage} />
      </Group>
      <div className="meters">
        <Meter label={t('life_fuel')} value={v.fuel} />
        <Meter label={t('life_engine')} value={v.engine} />
        <Meter label={t('life_body')} value={v.body} />
      </div>
      <Group>
        <Row tone="tint" icon={<MapPin size={20} />} title={t('life_locate_vehicle')} onClick={() => waypoint(v.name)} />
        {v.state !== 'out' && <Row tone="tint" icon={<Car size={20} />} title={impound ? t('life_pay_impound_fee_amount', { amount: money(fee, 0) }) : t('life_valet_to_me_amount', { amount: money(fee, 0) })} onClick={bring} />}
      </Group>
    </Page>
  );
}

function Vehicles() {
  const s = useS();
  const nav = useNav();
  return (
    <Page title={t('life_garage')} large>
      <div className="car-list">
        {s.vehicles.map((v) => (
          <button key={v.id} onClick={() => nav.push(<VehicleView id={v.id} />)}>
            <span className="car-ic">
              <CarArt color={v.color} width={50} />
            </span>
            <span className="row-main">
              <b>{v.name}</b>
              <small>
                {v.plate} · {v.garage}
              </small>
            </span>
            <span className={`pill ${STATE[v.state][1]}`}>{t(STATE[v.state][0])}</span>
          </button>
        ))}
      </div>
    </Page>
  );
}

export function GarageApp() {
  return (
    <Stack>
      <Vehicles />
    </Stack>
  );
}

/* ---------- Services ---------- */

const SERVICE_ICONS = { police: Shield, ambulance: Ambulance, mechanic: Wrench, taxi: Car, realestate: Building2, lawyer: Scale } as const;

function ServiceList() {
  return (
    <Page title={t('life_services')} large>
      <div className="svc-list">
        {services.map((v) => {
          const I = SERVICE_ICONS[v.id as keyof typeof SERVICE_ICONS];
          return (
            <div key={v.id} className="svc">
              <span className="svc-ic" style={{ background: v.color }}>
                <I size={24} />
              </span>
              <span className="row-main">
                <b>{v.name}</b>
                <small>{v.desc}</small>
                <small className={v.online ? 'pos' : ''}>{v.online ? t('life_online_available', { online: v.online }) : t('life_nobody_on_duty')}</small>
              </span>
              <button aria-label={t('life_message_name', { name: v.name })} disabled={!v.online} onClick={() => openApp('messages', null, { chat: chatWith(v.number) })}>
                <MessageCircle size={20} fill="currentColor" strokeWidth={0} />
              </button>
              <button aria-label={t('life_call_name', { name: v.name })} disabled={!v.online} onClick={() => startCall(v.number)}>
                <Phone size={20} fill="currentColor" strokeWidth={0} />
              </button>
            </div>
          );
        })}
      </div>
    </Page>
  );
}

function Job() {
  const s = useS();
  const j = s.job;
  const co = services.find((x) => x.id === j.company)!;
  const move = (dir: 1 | -1) =>
    prompt(dir > 0 ? t('life_deposit') : t('life_withdraw'), t('amount'), (v) => {
      const amt = Math.floor(Number(v));
      if (!(amt > 0) || (dir > 0 ? amt > S.wallet.balance : amt > j.balance)) return alert({ title: t('insufficient_funds'), buttons: [{ label: t('ok'), kind: 'bold' }] });
      pay(-dir * amt, `${co.name} account`);
      update(() => (j.balance += dir * amt));
    });
  return (
    <Page title={co.name} large>
      <Group footer={t('life_while_on_duty_you_receive_calls')}>
        <Row title={t('life_on_duty')} sub={j.grade} right={<Toggle label={t('life_on_duty_2')} on={j.duty} onChange={(v) => update(() => (j.duty = v))} />} />
      </Group>
      {j.boss && (
        <Group header={t('life_company_account')}>
          <Row title={t('life_balance')} value={money(j.balance, 0)} />
          <Row tone="tint" title={t('life_deposit')} onClick={() => move(1)} />
          <Row tone="tint" title={t('life_withdraw')} onClick={() => move(-1)} />
        </Group>
      )}
      <Group header={t('life_employees')}>
        {j.staff.map((p) => (
          <Row
            key={p.name}
            icon={<Avatar name={p.name} size={32} />}
            title={p.name}
            sub={`${p.grade} · ${p.online ? 'Online' : 'Offline'}`}
            chevron={j.boss && p.name !== s.me.name}
            onClick={
              j.boss && p.name !== s.me.name
                ? () =>
                    actions({
                      title: p.name,
                      options: [
                        ...['Trainee', 'Mechanic', 'Manager'].filter((g) => g !== p.grade).map((g) => ({ label: t('life_set_grade_g', { g }), run: () => update(() => (p.grade = g)) })),
                        { label: t('life_fire'), destructive: true, run: () => update(() => (j.staff = j.staff.filter((x) => x !== p))) },
                      ],
                    })
                : undefined
            }
          />
        ))}
        {j.boss && (
          <Row
            tone="tint"
            title={t('life_hire_employee')}
            onClick={() => actions({ title: t('life_hire'), options: s.contacts.filter((c) => !j.staff.some((p) => p.name === c.name)).slice(0, 6).map((c) => ({ label: c.name, run: () => update(() => j.staff.push({ name: c.name, grade: 'Trainee', online: false })) })) })}
          />
        )}
      </Group>
    </Page>
  );
}

export function ServicesApp() {
  return (
    <Tabs
      tabs={[
        { id: 'services', label: t('life_services'), icon: <Building2 size={24} />, view: <ServiceList /> },
        { id: 'job', label: t('life_my_job'), icon: <Briefcase size={24} />, view: <Job /> },
      ]}
    />
  );
}
