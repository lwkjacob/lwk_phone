import { useEffect, useState } from 'react';
import type { Coin } from '../data';
import { S, alert, money, pay, update, useS } from '../store';
import { Field, Group, Page, Row, Seg, Sheet, Stack, useNav } from '../ui';

const fmt = (v: number) => money(v, v < 1 ? 4 : 2);

function Spark({ hist, up, w = 72, h = 28, fill }: { hist: number[]; up: boolean; w?: number; h?: number; fill?: boolean }) {
  const lo = Math.min(...hist);
  const hi = Math.max(...hist);
  const pts = hist.map((v, i) => `${(i / (hist.length - 1)) * w},${h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4)}`);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={`spark ${up ? 'up' : 'down'}`} aria-hidden="true">
      {fill && <path d={`M0,${h} L${pts.join(' L')} L${w},${h} Z`} className="spark-fill" />}
      <path d={`M${pts.join(' L')}`} fill="none" strokeWidth={fill ? 2.5 : 1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Trade({ id, mode, onClose }: { id: string; mode: 'buy' | 'sell'; onClose: () => void }) {
  const s = useS();
  const c = s.coins.find((x) => x.id === id)!;
  const [usd, setUsd] = useState('');
  const v = Number(usd);
  const qty = v / c.price;
  const run = () => {
    if (mode === 'buy' ? v > S.wallet.balance : qty > c.owned) return alert({ title: mode === 'buy' ? 'Insufficient Funds' : 'Not Enough to Sell', message: mode === 'buy' ? 'Your bank balance is too low.' : `You only hold ${c.owned.toFixed(4)} ${c.id}.`, buttons: [{ label: 'OK', kind: 'bold' }] });
    pay(mode === 'buy' ? -v : v, `${mode === 'buy' ? 'Bought' : 'Sold'} ${c.id}`);
    update(() => (c.owned += mode === 'buy' ? qty : -qty));
  };
  return (
    <Sheet title={`${mode === 'buy' ? 'Buy' : 'Sell'} ${c.name}`} onClose={onClose} action={{ label: mode === 'buy' ? 'Buy' : 'Sell', disabled: !(v > 0), run }}>
      <Group footer={`${fmt(c.price)} per ${c.id} · Bank balance ${money(s.wallet.balance)}`}>
        <Field label="Amount" value={usd} onChange={(x) => setUsd(x.replace(/[^\d.]/g, ''))} placeholder="$0.00" />
        <Row title={`You ${mode === 'buy' ? 'get' : 'sell'}`} value={`${v > 0 ? qty.toFixed(6) : '0'} ${c.id}`} />
      </Group>
      {mode === 'sell' && (
        <div className="btn-row">
          <button className="btn soft" onClick={() => setUsd((c.owned * c.price).toFixed(2))}>
            Sell All
          </button>
        </div>
      )}
    </Sheet>
  );
}

function CoinIcon({ c, size = 38 }: { c: Coin; size?: number }) {
  return (
    <span className="coin-ic" style={{ background: c.color, width: size, height: size, fontSize: size * 0.3 }}>
      {c.id}
    </span>
  );
}

function CoinView({ id }: { id: string }) {
  const s = useS();
  const [range, setRange] = useState<'1H' | '1D' | '1W' | '1M'>('1D');
  const [trade, setTrade] = useState<'buy' | 'sell' | null>(null);
  const c = s.coins.find((x) => x.id === id)!;
  const n = { '1H': 8, '1D': 16, '1W': 24, '1M': 32 }[range];
  return (
    <Page title={c.name} back="Crypto">
      <div className="coin-head">
        <CoinIcon c={c} size={44} />
        <strong>{fmt(c.price)}</strong>
        <span className={c.change >= 0 ? 'pos' : 'neg'}>
          {c.change >= 0 ? '+' : ''}
          {c.change.toFixed(2)}% today
        </span>
      </div>
      <Spark hist={c.hist.slice(-n)} up={c.change >= 0} w={361} h={180} fill />
      <div className="pad-x">
        <Seg value={range} onChange={setRange} options={[['1H', '1H'], ['1D', '1D'], ['1W', '1W'], ['1M', '1M']] as const} />
      </div>
      <Group header="Your Position">
        <Row title="Holdings" value={`${c.owned.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${c.id}`} />
        <Row title="Value" value={money(c.owned * c.price)} />
      </Group>
      <div className="btn-row">
        <button className="btn" onClick={() => setTrade('buy')}>
          Buy
        </button>
        <button className="btn soft" disabled={!c.owned} onClick={() => setTrade('sell')}>
          Sell
        </button>
      </div>
      {trade && <Trade id={id} mode={trade} onClose={() => setTrade(null)} />}
    </Page>
  );
}

function Portfolio() {
  const s = useS();
  const nav = useNav();
  // Mock ticker: prices drift while the app is open. In-game the server pushes these.
  useEffect(() => {
    const t = window.setInterval(
      () =>
        update((x) =>
          x.coins.forEach((c) => {
            const step = (Math.random() - 0.48) * 0.006;
            c.price *= 1 + step;
            c.change += step * 100;
            c.hist = [...c.hist.slice(1), c.hist[c.hist.length - 1] * (1 + step * 4)];
          }),
        ),
      2500,
    );
    return () => window.clearInterval(t);
  }, []);
  const total = s.coins.reduce((a, c) => a + c.owned * c.price, 0);
  return (
    <Page title="Crypto" large>
      <div className="balance">
        <small>Portfolio Value</small>
        <strong>{money(total)}</strong>
        <span>Bank balance {money(s.wallet.balance)}</span>
      </div>
      <div className="list coins">
        {s.coins.map((c) => (
          <button key={c.id} className="row" onClick={() => nav.push(<CoinView id={c.id} />)}>
            <CoinIcon c={c} />
            <span className="row-main">
              <span className="row-t">{c.name}</span>
              <span className="row-s">{c.owned ? `${c.owned.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${c.id}` : c.id}</span>
            </span>
            <Spark hist={c.hist} up={c.change >= 0} />
            <span className="coin-px">
              <b>{fmt(c.price)}</b>
              <small className={c.change >= 0 ? 'pos' : 'neg'}>
                {c.change >= 0 ? '+' : ''}
                {c.change.toFixed(2)}%
              </small>
            </span>
          </button>
        ))}
      </div>
    </Page>
  );
}

export function CryptoApp() {
  return (
    <Stack>
      <Portfolio />
    </Stack>
  );
}
