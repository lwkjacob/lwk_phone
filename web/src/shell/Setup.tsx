import { useEffect, useState } from 'react';
import { ArrowRight, Check, ScanFace, Smartphone } from 'lucide-react';
import { t } from '../i18n';
import { inGame, rpc } from '../net';
import { finishSetup, hydrate, markSaved, update, useS } from '../store';
import { DialPad } from '../ui';

/* First-run setup: greeting, (an old phone to move from,) appearance, passcode. Shown until finished once.
 * In the browser that is remembered in localStorage; in-game the server decides (see finishSetup). */

type Step = 'hello' | 'move' | 'look' | 'lock' | 'done';

/** What an old phone can hold, in the order it is brought across: [count key, label key]. */
const KINDS = [
  ['contacts', 'contacts'],
  ['threads', 'transfer_conversations'],
  ['calls', 'transfer_calls'],
  ['photos', 'photos'],
  ['notes', 'util_notes'],
] as const;

/**
 * "Transfer from your old phone". Offers it, shows it happening, and says when it is done.
 * The number moves by itself whatever is chosen here; this is about what was on the phone.
 */
function Move({ onDone }: { onDone: () => void }) {
  const s = useS();
  const old = s.oldPhone!;
  const kinds = KINDS.filter(([k]) => old.counts[k] > 0);
  const [phase, setPhase] = useState<'offer' | 'moving' | 'moved'>('offer');
  // How many of the kinds have arrived, for the list ticking off and the bar filling.
  const [arrived, setArrived] = useState(0);

  const run = async () => {
    setPhase('moving');
    // The server does it in one go; the list ticks off at a pace someone can watch, and waits for the server at the end.
    const moved = inGame ? rpc<Record<string, unknown>>('transfer.run') : Promise.resolve(null);
    for (let i = 1; i <= kinds.length; i++) {
      await new Promise((r) => window.setTimeout(r, 650));
      setArrived(i);
    }
    const r = await moved;
    if (r?.ok) {
      const { ok: _ok, ...slices } = r;
      hydrate(slices);
      // What arrived is already saved on the server: nothing to send back.
      markSaved();
    }
    setPhase('moved');
  };
  const skip = () => (inGame && rpc('transfer.skip'), onDone());

  return (
    <>
      <div className={`move-art ${phase}`} aria-hidden="true">
        <Smartphone size={54} strokeWidth={1.4} />
        <span className="move-flow">
          {phase === 'moved' ? <Check size={26} strokeWidth={3.4} /> : phase === 'moving' ? [0, 1, 2].map((i) => <i key={i} style={{ animationDelay: `${i * 0.22}s` }} />) : <ArrowRight size={24} strokeWidth={2.6} />}
        </span>
        <Smartphone size={64} strokeWidth={1.4} className="tint" />
      </div>
      <h1>{phase === 'moved' ? t('transfer_done') : phase === 'moving' ? t('transfer_moving') : t('transfer_title')}</h1>
      <p>{phase === 'moved' ? t('transfer_done_text') : t('transfer_text', { from: old.from })}</p>

      <ul className="move-list">
        {kinds.map(([k, label], i) => (
          <li key={k} className={phase !== 'offer' && i < arrived ? 'in' : phase === 'moving' && i === arrived ? 'now' : ''}>
            <span>{t(label)}</span>
            <b>{old.counts[k].toLocaleString()}</b>
            <i>{phase !== 'offer' && i < arrived && <Check size={13} strokeWidth={4} />}</i>
          </li>
        ))}
      </ul>
      {phase === 'moving' && (
        <div className="move-bar" role="progressbar" aria-valuemin={0} aria-valuemax={kinds.length} aria-valuenow={arrived}>
          <i style={{ width: `${(arrived / kinds.length) * 100}%` }} />
        </div>
      )}

      <div className="move-foot">
        {phase === 'offer' && (
          <>
            <button className="btn" onClick={run}>
              {t('transfer_go')}
            </button>
            <button className="btn ghost" onClick={skip}>
              {t('transfer_skip')}
            </button>
            <small>{t('transfer_keep_number', { number: s.me.number })}</small>
          </>
        )}
        {phase === 'moved' && (
          <button className="btn" onClick={onDone}>
            {t('continue')}
          </button>
        )}
      </div>
    </>
  );
}

export function Setup() {
  const s = useS();
  const [step, setStep] = useState(0);
  const [code, setCode] = useState('');
  const [first, setFirst] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const showing = s.setup;
  // In-game: ask once, as setup comes up, whether this player has an old phone to move from.
  useEffect(() => {
    if (!showing || !inGame) return;
    rpc<{ found: boolean; from: string; counts: NonNullable<typeof s.oldPhone>['counts'] }>('transfer.check').then((r) => update((x) => (x.oldPhone = r?.ok && r.found ? { from: r.from, counts: r.counts } : null)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per setup
  }, [showing]);
  if (!s.setup) return null;

  const steps: Step[] = ['hello', ...(s.oldPhone ? (['move'] as const) : []), 'look', 'lock', 'done'];
  const at = steps[Math.min(step, steps.length - 1)];
  const next = () => setStep((n) => n + 1);

  const key = (k: string) => {
    const entry = (code + k).slice(0, 4);
    setCode(entry);
    setMismatch(false);
    if (entry.length < 4) return;
    // Entered twice to confirm, like any passcode setup.
    if (!first) return window.setTimeout(() => (setFirst(entry), setCode('')), 160);
    if (entry !== first) return window.setTimeout(() => (setFirst(''), setCode(''), setMismatch(true)), 160);
    update((x) => (x.settings.passcode = entry));
    window.setTimeout(next, 160);
  };

  return (
    <div className="setup" role="dialog" aria-label={t('setup_title')} data-theme={s.settings.dark ? 'dark' : 'light'}>
      <div className={`setup-step ${at === 'move' ? 'move' : ''}`} key={at}>
        {at === 'hello' && (
          <>
            <h1 className="setup-hello">{t('setup_hello')}</h1>
            <p>{t('setup_intro')}</p>
          </>
        )}

        {at === 'move' && <Move onDone={next} />}

        {at === 'look' && (
          <>
            <h1>{t('setup_appearance')}</h1>
            <p>{t('setup_appearance_text')}</p>
            <div className="appearance">
              {([false, true] as const).map((dark) => (
                <button key={String(dark)} aria-pressed={s.settings.dark === dark} onClick={() => update((x) => (x.settings.dark = dark))}>
                  <span className={`mini-phone ${dark ? 'dark' : ''}`}>9:41</span>
                  {dark ? t('settings_dark') : t('settings_light')}
                  <i>{s.settings.dark === dark && <Check size={14} strokeWidth={4} />}</i>
                </button>
              ))}
            </div>
          </>
        )}

        {at === 'lock' && (
          <>
            <ScanFace size={44} className="tint" />
            <h1>{first ? t('setup_passcode_again') : t('setup_passcode')}</h1>
            <p>{mismatch ? t('setup_passcode_mismatch') : t('setup_passcode_text')}</p>
            <div className="pass-dots" aria-label={t('setup_digits', { n: code.length })}>
              {[0, 1, 2, 3].map((i) => (
                <i key={i} className={i < code.length ? 'on' : ''} />
              ))}
            </div>
            <DialPad digits onKey={key} />
          </>
        )}

        {at === 'done' && (
          <>
            <h1>{t('setup_done', { name: s.me.name.split(' ')[0] })}</h1>
            <p>{t('setup_done_text')}</p>
          </>
        )}
      </div>

      {/* The transfer step has its own buttons: it is not something to tap "Continue" past. */}
      {at !== 'move' && (
        <div className="setup-foot">
          {at === 'lock' ? (
            <button className="btn ghost" onClick={next}>
              {t('setup_later')}
            </button>
          ) : (
            <button className="btn" onClick={at === 'done' ? finishSetup : next}>
              {at === 'done' ? t('setup_start') : t('continue')}
            </button>
          )}
          <div className="setup-dots" aria-hidden="true">
            {steps.map((id, i) => (
              <i key={id} className={i === step ? 'on' : ''} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
