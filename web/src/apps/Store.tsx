import { useState } from 'react';
import { LayoutGrid, Newspaper, Search as SearchIcon, Star } from 'lucide-react';
import { S, alert, confirm, goHome, money, openApp, pay, update, useS } from '../store';
import { Empty, Group, Page, Row, Search, Tabs, useNav } from '../ui';
import { APPS, AppIcon, appEvent } from './index';

const busy = new Set<string>();
const installed = (id: string) => S.apps.includes(id) || S.dock.includes(id);

function install(id: string) {
  const price = APPS[id].custom?.price ?? 0;
  if (price > S.wallet.balance) return alert({ title: 'Insufficient Funds', message: `${APPS[id].name} costs ${money(price, 0)}.`, buttons: [{ label: 'OK', kind: 'bold' }] });
  if (price) pay(-price, `App Store · ${APPS[id].name}`);
  appEvent(id, 'install');
  busy.add(id);
  update();
  // Mock download time.
  window.setTimeout(() => {
    busy.delete(id);
    update((s) => APPS[id] && !installed(id) && s.apps.push(id));
  }, 1500);
}

function GetBtn({ id }: { id: string }) {
  useS();
  if (busy.has(id)) return <span className="get busy" role="status" aria-label="Installing" />;
  return installed(id) ? (
    <button className="get" onClick={(e) => (e.stopPropagation(), goHome(), window.setTimeout(() => openApp(id), 420))}>
      Open
    </button>
  ) : (
    <button className="get" onClick={(e) => (e.stopPropagation(), install(id))}>
      {APPS[id]?.custom?.price ? money(APPS[id].custom.price, 0) : 'Get'}
    </button>
  );
}

function AppPage({ id }: { id: string }) {
  useS();
  const nav = useNav();
  const a = APPS[id];
  // A community app can be removed by its resource while this page is open.
  if (!a) return <Page back="Apps" />;
  const shots = a.custom?.images ?? [];
  return (
    <Page back="Apps">
      <div className="store-head">
        <AppIcon id={id} size={112} />
        <div>
          <h1>{a.name}</h1>
          <p>{a.cat}</p>
          <GetBtn id={id} />
        </div>
      </div>
      <div className="store-stats">
        <span>
          <small>4.8K RATINGS</small>
          <b>4.7</b>
          <span className="stars">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} size={11} fill="currentColor" strokeWidth={0} />
            ))}
          </span>
        </span>
        <span>
          <small>AGE</small>
          <b>17+</b>
          <small>Years Old</small>
        </span>
        <span>
          <small>CATEGORY</small>
          <b>
            <LayoutGrid size={20} />
          </b>
          <small>{a.cat}</small>
        </span>
      </div>
      <div className="store-shots">
        {shots.length
          ? shots.map((src) => <img key={src} src={src} alt="" />)
          : [0, 1, 2].map((i) => (
              <div key={i} style={{ background: a.bg, color: a.fg ?? '#fff' }}>
                {a.icon ? <img src={a.icon} alt="" /> : a.glyph}
              </div>
            ))}
      </div>
      <p className="store-desc">{a.desc}</p>
      {installed(id) && !a.system && (
        <Group>
          <Row
            tone="danger"
            title="Delete App"
            onClick={() => confirm(`Delete “${a.name}”?`, 'You can install it again at any time.', 'Delete', () => (nav.pop(), appEvent(id, 'delete'), update((s) => ((s.apps = s.apps.filter((x) => x !== id)), (s.dock = s.dock.filter((x) => x !== id))))))}
          />
        </Group>
      )}
    </Page>
  );
}

function AppRow({ id }: { id: string }) {
  const nav = useNav();
  const a = APPS[id];
  if (!a) return null;
  return (
    <div className="store-row" role="button" tabIndex={0} onClick={() => nav.push(<AppPage id={id} />)} onKeyDown={(e) => e.key === 'Enter' && nav.push(<AppPage id={id} />)}>
      <AppIcon id={id} size={60} />
      <span className="row-main">
        <b>{a.name}</b>
        <small>{a.desc.split('.')[0]}</small>
      </span>
      <GetBtn id={id} />
    </div>
  );
}

function Today() {
  const nav = useNav();
  const featured = ['lumen', 'ember'];
  return (
    <Page>
      <div className="today-head">
        <small>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</small>
        <h1 className="lg-title">Today</h1>
      </div>
      {featured.map((id, i) => (
        <div key={id} className="today-card" role="button" tabIndex={0} style={{ background: APPS[id].bg }} onClick={() => nav.push(<AppPage id={id} />)} onKeyDown={(e) => e.key === 'Enter' && nav.push(<AppPage id={id} />)}>
          <small>{i ? 'NEW IN TOWN' : 'APP OF THE DAY'}</small>
          <h2>{i ? 'Meet someone who drives worse than you' : 'Los Santos, through your lens'}</h2>
          <span className="today-app">
            <AppIcon id={id} size={44} />
            <span>
              <b>{APPS[id].name}</b>
              <small>{APPS[id].cat}</small>
            </span>
            <GetBtn id={id} />
          </span>
        </div>
      ))}
      <h2 className="sec-h">Essentials</h2>
      {['clock', 'weather', 'notes', 'calc', 'music'].map((id) => (
        <AppRow key={id} id={id} />
      ))}
    </Page>
  );
}

function AllApps() {
  useS();
  const ids = Object.keys(APPS).filter((id) => !APPS[id].core);
  const community = ids.filter((id) => APPS[id].custom);
  return (
    <Page title="Apps" large>
      {community.length > 0 && <h2 className="sec-h">From This Server</h2>}
      {community.map((id) => (
        <AppRow key={id} id={id} />
      ))}
      {community.length > 0 && <h2 className="sec-h">Add-ons</h2>}
      {ids
        .filter((id) => !APPS[id].custom)
        .map((id) => (
          <AppRow key={id} id={id} />
        ))}
    </Page>
  );
}

function Find() {
  const [q, setQ] = useState('');
  const ids = Object.keys(APPS).filter((id) => `${APPS[id].name} ${APPS[id].cat} ${APPS[id].desc}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Page title="Search" large>
      <Search value={q} onChange={setQ} placeholder="Apps and more" />
      {ids.map((id) => (
        <AppRow key={id} id={id} />
      ))}
      {!ids.length && <Empty icon={<SearchIcon size={44} />} title="No Results" text={`Nothing matches “${q}”.`} />}
    </Page>
  );
}

export function StoreApp() {
  return (
    <Tabs
      tabs={[
        { id: 'today', label: 'Today', icon: <Newspaper size={24} />, view: <Today /> },
        { id: 'apps', label: 'Apps', icon: <LayoutGrid size={24} fill="currentColor" />, view: <AllApps /> },
        { id: 'search', label: 'Search', icon: <SearchIcon size={24} strokeWidth={2.6} />, view: <Find /> },
      ]}
    />
  );
}
