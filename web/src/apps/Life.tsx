import { useState } from 'react';
import { Ambulance, Briefcase, Building2, Car, DoorClosed, DoorOpen, KeyRound, Lightbulb, MapPin, MessageCircle, Phone, Scale, Shield, Wrench } from 'lucide-react';
import { services } from '../data';
import { S, actions, alert, chatWith, confirm, fmtAgo, money, nameOf, notify, openApp, pay, prompt, share, startCall, update, useS } from '../store';
import { Avatar, Field, Group, Page, Pic, Row, Seg, Sheet, Stack, Tabs, Toggle, useNav } from '../ui';

/* ---------- Wallet ---------- */

function MoneySheet({ onClose }: { onClose: () => void }) {
  const s = useS();
  const [mode, setMode] = useState<'send' | 'request'>('send');
  const [to, setTo] = useState(s.contacts[0]?.number ?? '');
  const [amount, setAmount] = useState('');
  const v = Math.floor(Number(amount));
  const run = () => {
    if (mode === 'request') return notify({ app: 'wallet', title: 'Request sent', body: `${nameOf(to)} was asked for ${money(v, 0)}.` });
    if (v > S.wallet.balance) return alert({ title: 'Insufficient Funds', message: 'Your balance is too low for this transfer.', buttons: [{ label: 'OK', kind: 'bold' }] });
    pay(-v, nameOf(to));
  };
  return (
    <Sheet title={mode === 'send' ? 'Send Money' : 'Request Money'} onClose={onClose} action={{ label: mode === 'send' ? 'Send' : 'Request', disabled: !(v > 0) || !to, run }}>
      <div className="pad-x">
        <Seg value={mode} onChange={setMode} options={[['send', 'Send'], ['request', 'Request']] as const} />
      </div>
      <Group>
        <Field label="Amount" value={amount} onChange={(x) => setAmount(x.replace(/[^\d]/g, ''))} placeholder="$0" />
      </Group>
      <Group header="To">
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
      <Page title="Wallet" large>
        <div className="cards">
          <div className="bank-card">
            <span className="bank-brand">
              LWK <small>BANK</small>
            </span>
            <i className="bank-chip" />
            <span className="bank-num">•••• •••• •••• 4118</span>
            <span className="bank-name">{s.me.name}</span>
            <b>DEBIT</b>
          </div>
          <div className="id-card">
            <span>San Andreas · Driver Licence</span>
            <Avatar name={s.me.name} size={52} />
            <b>{s.me.name}</b>
            <small>Class C · DL 48-20-4118 · Exp 12/29</small>
          </div>
        </div>
        <div className="balance">
          <small>Balance</small>
          <strong>{money(s.wallet.balance)}</strong>
          <span>
            Cash {money(s.wallet.cash, 0)} · {s.wallet.iban}
          </span>
        </div>
        <div className="btn-row">
          <button className="btn" onClick={() => setSheet(true)}>
            Send or Request
          </button>
        </div>
        <Group header="Latest Transactions">
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

const waypoint = (name: string) => notify({ app: 'maps', title: 'Waypoint set', body: `Route to ${name} is on your GPS.` });

function HouseView({ id }: { id: number }) {
  const s = useS();
  const h = s.houses.find((x) => x.id === id);
  if (!h) return null;
  return (
    <Page title={h.name} back="Home">
      <Pic seed={h.seed} className="house-cover" alt={h.name} />
      <div className="tiles">
        <button aria-pressed={!h.locked} onClick={() => update(() => (h.locked = !h.locked))}>
          {h.locked ? <DoorClosed size={26} /> : <DoorOpen size={26} />}
          <b>Front Door</b>
          <small>{h.locked ? 'Locked' : 'Unlocked'}</small>
        </button>
        <button aria-pressed={h.lights} onClick={() => update(() => (h.lights = !h.lights))}>
          <Lightbulb size={26} fill={h.lights ? 'currentColor' : 'none'} />
          <b>Lights</b>
          <small>{h.lights ? 'On' : 'Off'}</small>
        </button>
      </div>
      <Group header="Keys" footer="Key holders can enter this property and use its storage.">
        {h.keys.map((num) => (
          <Row
            key={num}
            icon={<Avatar name={nameOf(num)} size={32} />}
            title={nameOf(num)}
            right={
              <button className="danger" onClick={() => update(() => (h.keys = h.keys.filter((k) => k !== num)))}>
                Revoke
              </button>
            }
          />
        ))}
        <Row
          tone="tint"
          icon={<KeyRound size={20} />}
          title="Give Key"
          onClick={() => actions({ title: 'Give a key to', options: s.contacts.filter((c) => !h.keys.includes(c.number)).slice(0, 6).map((c) => ({ label: c.name, run: () => update(() => h.keys.push(c.number)) })) })}
        />
      </Group>
      <Group>
        <Row tone="tint" title="Set Waypoint" onClick={() => waypoint(h.name)} />
        <Row tone="tint" title="Share Address" onClick={() => share({ kind: 'Location', label: `${h.name} · ${h.addr}` })} />
      </Group>
    </Page>
  );
}

function Houses() {
  const s = useS();
  const nav = useNav();
  return (
    <Page title="Home" large>
      <div className="house-list">
        {s.houses.map((h) => (
          <button key={h.id} onClick={() => nav.push(<HouseView id={h.id} />)}>
            <Pic seed={h.seed} />
            <span>
              <b>{h.name}</b>
              <small>{h.addr}</small>
            </span>
            <span className={`pill ${h.locked ? '' : 'warn'}`}>{h.locked ? 'Locked' : 'Unlocked'}</span>
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

const STATE = { out: ['Out', 'ok'], garaged: ['Garaged', ''], impound: ['Impounded', 'bad'] } as const;

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
    confirm(impound ? 'Pay Impound Fee' : 'Request Valet', `${money(fee, 0)} will be charged to your bank account.`, 'Pay', () => {
      if (fee > S.wallet.balance) return alert({ title: 'Insufficient Funds', buttons: [{ label: 'OK', kind: 'bold' }] });
      pay(-fee, impound ? 'Impound fee' : 'Valet service');
      update(() => (v.state = 'out'));
      notify({ app: 'garage', title: v.name, body: impound ? 'Released from impound.' : 'Your valet is on the way.' });
    });
  return (
    <Page title={v.name} back="Garage">
      <div className="car-hero">
        <CarArt color={v.color} width={270} />
        <span className="plate">{v.plate}</span>
      </div>
      <Group>
        <Row title="Status" right={<span className={`pill ${STATE[v.state][1]}`}>{STATE[v.state][0]}</span>} />
        <Row title="Location" value={v.garage} />
      </Group>
      <div className="meters">
        <Meter label="Fuel" value={v.fuel} />
        <Meter label="Engine" value={v.engine} />
        <Meter label="Body" value={v.body} />
      </div>
      <Group>
        <Row tone="tint" icon={<MapPin size={20} />} title="Locate Vehicle" onClick={() => waypoint(v.name)} />
        {v.state !== 'out' && <Row tone="tint" icon={<Car size={20} />} title={impound ? `Pay Impound Fee (${money(fee, 0)})` : `Valet to Me (${money(fee, 0)})`} onClick={bring} />}
      </Group>
    </Page>
  );
}

function Vehicles() {
  const s = useS();
  const nav = useNav();
  return (
    <Page title="Garage" large>
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
            <span className={`pill ${STATE[v.state][1]}`}>{STATE[v.state][0]}</span>
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
    <Page title="Services" large>
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
                <small className={v.online ? 'pos' : ''}>{v.online ? `${v.online} available` : 'Nobody on duty'}</small>
              </span>
              <button aria-label={`Message ${v.name}`} disabled={!v.online} onClick={() => openApp('messages', null, { chat: chatWith(v.number) })}>
                <MessageCircle size={20} fill="currentColor" strokeWidth={0} />
              </button>
              <button aria-label={`Call ${v.name}`} disabled={!v.online} onClick={() => startCall(v.number)}>
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
    prompt(dir > 0 ? 'Deposit' : 'Withdraw', 'Amount', (v) => {
      const amt = Math.floor(Number(v));
      if (!(amt > 0) || (dir > 0 ? amt > S.wallet.balance : amt > j.balance)) return alert({ title: 'Insufficient Funds', buttons: [{ label: 'OK', kind: 'bold' }] });
      pay(-dir * amt, `${co.name} account`);
      update(() => (j.balance += dir * amt));
    });
  return (
    <Page title={co.name} large>
      <Group footer="While on duty you receive calls and messages sent to your company.">
        <Row title="On Duty" sub={j.grade} right={<Toggle label="On duty" on={j.duty} onChange={(v) => update(() => (j.duty = v))} />} />
      </Group>
      {j.boss && (
        <Group header="Company Account">
          <Row title="Balance" value={money(j.balance, 0)} />
          <Row tone="tint" title="Deposit" onClick={() => move(1)} />
          <Row tone="tint" title="Withdraw" onClick={() => move(-1)} />
        </Group>
      )}
      <Group header="Employees">
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
                        ...['Trainee', 'Mechanic', 'Manager'].filter((g) => g !== p.grade).map((g) => ({ label: `Set grade: ${g}`, run: () => update(() => (p.grade = g)) })),
                        { label: 'Fire', destructive: true, run: () => update(() => (j.staff = j.staff.filter((x) => x !== p))) },
                      ],
                    })
                : undefined
            }
          />
        ))}
        {j.boss && (
          <Row
            tone="tint"
            title="Hire Employee"
            onClick={() => actions({ title: 'Hire', options: s.contacts.filter((c) => !j.staff.some((p) => p.name === c.name)).slice(0, 6).map((c) => ({ label: c.name, run: () => update(() => j.staff.push({ name: c.name, grade: 'Trainee', online: false })) })) })}
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
        { id: 'services', label: 'Services', icon: <Building2 size={24} />, view: <ServiceList /> },
        { id: 'job', label: 'My Job', icon: <Briefcase size={24} />, view: <Job /> },
      ]}
    />
  );
}
