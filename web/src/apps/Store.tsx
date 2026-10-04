import { useState } from 'react';
import { LayoutGrid, Newspaper, Search as SearchIcon, Star } from 'lucide-react';
import { inGame } from '../net';
import { S, alert, confirm, goHome, money, openApp, pay, send, update, useS } from '../store';
import { Empty, Group, Page, Row, Search, Tabs, useNav } from '../ui';
import { APPS, AppIcon, appEvent } from './index';
import { intl, t } from '../i18n';

const busy = new Set<string>();
const installed = (id: string) => S.apps.includes(id) || S.dock.includes(id);

async function install(id: string) {
  // No money on this server (no Wallet app): priced apps are free.
  const price = inGame && !APPS.wallet ? 0 : (APPS[id].custom?.price ?? 0);
  if (inGame) {
    // The server takes the payment, and says why if it cannot.
    if (price && !(await send('app.buy', { name: APPS[id].name, price }))) return;
  } else if (price > S.wallet.balance) return alert({ title: t('insufficient_funds'), message: t('store_name_costs_amount', { name: APPS[id].name, amount: money(price, 0) }), buttons: [{ label: t('ok'), kind: 'bold' }] });
  else if (price) pay(-price, `App Store · ${APPS[id].name}`);
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
  if (busy.has(id)) return <span className="get busy" role="status" aria-label={t('store_installing')} />;
  return installed(id) ? (
    <button className="get" onClick={(e) => (e.stopPropagation(), goHome(), window.setTimeout(() => openApp(id), 420))}>
      {t('store_open')}
    </button>
  ) : (
    <button className="get" onClick={(e) => (e.stopPropagation(), install(id))}>
      {APPS[id]?.custom?.price ? money(APPS[id].custom.price, 0) : t('store_get')}
    </button>
  );
}

function AppPage({ id }: { id: string }) {
  useS();
  const nav = useNav();
  const a = APPS[id];
  // A community app can be removed by its resource while this page is open.
  if (!a) return <Page back={t('apps')} />;
  const shots = a.custom?.images ?? [];
  return (
    <Page back={t('apps')}>
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
          <small>{t('store_4_8k_ratings')}</small>
          <b>4.7</b>
          <span className="stars">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} size={11} fill="currentColor" strokeWidth={0} />
            ))}
          </span>
        </span>
        <span>
          <small>{t('store_age')}</small>
          <b>17+</b>
          <small>{t('store_years_old')}</small>
        </span>
        <span>
          <small>{t('store_category')}</small>
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
            title={t('store_delete_app')}
            onClick={() => confirm(t('store_delete_name', { name: a.name }), t('store_you_can_install_it_again_at'), t('delete'), () => (nav.pop(), appEvent(id, 'delete'), update((s) => ((s.apps = s.apps.filter((x) => x !== id)), (s.dock = s.dock.filter((x) => x !== id))))))}
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
        <small>{new Date().toLocaleDateString(intl, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</small>
        <h1 className="lg-title">{t('today')}</h1>
      </div>
      {featured.map((id, i) => (
        <div key={id} className="today-card" role="button" tabIndex={0} style={{ background: APPS[id].bg }} onClick={() => nav.push(<AppPage id={id} />)} onKeyDown={(e) => e.key === 'Enter' && nav.push(<AppPage id={id} />)}>
          <small>{i ? t('store_new_in_town') : t('store_app_of_the_day')}</small>
          <h2>{i ? t('store_meet_someone_who_drives_worse_than') : t('store_los_santos_through_your_lens')}</h2>
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
      <h2 className="sec-h">{t('store_essentials')}</h2>
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
    <Page title={t('apps')} large>
      {community.length > 0 && <h2 className="sec-h">{t('store_from_this_server')}</h2>}
      {community.map((id) => (
        <AppRow key={id} id={id} />
      ))}
      {community.length > 0 && <h2 className="sec-h">{t('store_add_ons')}</h2>}
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
    <Page title={t('search')} large>
      <Search value={q} onChange={setQ} placeholder={t('store_apps_and_more')} />
      {ids.map((id) => (
        <AppRow key={id} id={id} />
      ))}
      {!ids.length && <Empty icon={<SearchIcon size={44} />} title={t('no_results')} text={t('nothing_matches_q', { q })} />}
    </Page>
  );
}

export function StoreApp() {
  return (
    <Tabs
      tabs={[
        { id: 'today', label: t('today'), icon: <Newspaper size={24} />, view: <Today /> },
        { id: 'apps', label: t('apps'), icon: <LayoutGrid size={24} fill="currentColor" />, view: <AllApps /> },
        { id: 'search', label: t('search'), icon: <SearchIcon size={24} strokeWidth={2.6} />, view: <Find /> },
      ]}
    />
  );
}
