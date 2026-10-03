import { useState } from 'react';
import { Check, ScanFace } from 'lucide-react';
import { t } from '../i18n';
import { finishSetup, update, useS } from '../store';
import { DialPad } from '../ui';

/* First-run setup: greeting, appearance, passcode. Shown until finished once.
 * In the browser that is remembered in localStorage; in-game the server decides (see finishSetup). */

const STEPS = ['hello', 'look', 'lock', 'done'] as const;

export function Setup() {
  const s = useS();
  const [step, setStep] = useState(0);
  const [code, setCode] = useState('');
  const [first, setFirst] = useState('');
  const [mismatch, setMismatch] = useState(false);
  if (!s.setup) return null;
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
      <div className="setup-step" key={STEPS[step]}>
        {STEPS[step] === 'hello' && (
          <>
            <h1 className="setup-hello">{t('setup_hello')}</h1>
            <p>{t('setup_intro')}</p>
          </>
        )}

        {STEPS[step] === 'look' && (
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

        {STEPS[step] === 'lock' && (
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

        {STEPS[step] === 'done' && (
          <>
            <h1>{t('setup_done', { name: s.me.name.split(' ')[0] })}</h1>
            <p>{t('setup_done_text')}</p>
          </>
        )}
      </div>

      <div className="setup-foot">
        {STEPS[step] === 'lock' ? (
          <button className="btn ghost" onClick={next}>
            {t('setup_later')}
          </button>
        ) : (
          <button className="btn" onClick={STEPS[step] === 'done' ? finishSetup : next}>
            {STEPS[step] === 'done' ? t('setup_start') : t('continue')}
          </button>
        )}
        <div className="setup-dots" aria-hidden="true">
          {STEPS.map((id, i) => (
            <i key={id} className={i === step ? 'on' : ''} />
          ))}
        </div>
      </div>
    </div>
  );
}
