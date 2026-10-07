import { useState } from 'react';
import { t } from './i18n';
import { Pic, Search, Seg, Sheet } from './ui';

/* Emoji and colour pickers. Used by the phone's own apps and handed to community apps
 * through components.setEmojiPickerVisible / setColorPicker. */

const EMOJI = {
  smileys: '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😋 😛 😜 🤪 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥 😔 😪 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😲 😳 🥺 😨 😰 😥 😢 😭 😱 😖 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 💀 🤡 👻 👽 🤖',
  people: '👍 👎 👊 ✊ 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✌️ 🤞 🤟 🤘 👌 🤏 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐 🖖 👋 🤙 💪 🦾 🖕 ✍️ 👀 👁 👅 👄 🧠 🫀 👶 🧒 👦 👧 🧑 👨 👩 🧓 👮 🕵️ 💂 👷 🤴 👸 🧑‍🔧 🧑‍⚕️ 🧑‍🍳 🧑‍✈️',
  hearts: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ♥️ 💌 💋 🌹 💐',
  things: '🔥 ⭐ ✨ ⚡ 💥 💯 💢 💤 💬 🎉 🎊 🎁 🏆 🥇 🚗 🚕 🚓 🚑 🚒 🏎 🏍 🚲 ✈️ 🚁 🚤 ⛽ 🔧 🔨 🔑 🔒 💰 💵 💳 💎 📱 💻 📷 🎮 🎵 🎧 🍕 🍔 🍟 🌮 🍩 🍺 ☕ 🌴 🌊 🌙 ☀️ ⛈ 🏠 🏥 🏦 🚨 ⚠️ ✅ ❌ ❓',
} as const;
type EmojiTab = keyof typeof EMOJI;
const TABS = Object.keys(EMOJI) as EmojiTab[];

/** The grid alone, for embedding (the message composer shows it above the text field). */
export function EmojiGrid({ onPick }: { onPick: (emoji: string) => void }) {
  const [tab, setTab] = useState<EmojiTab>('smileys');
  return (
    <div className="emoji">
      <Seg value={tab} onChange={setTab} options={TABS.map((k) => [k, t(`emoji_${k}`)] as const)} />
      <div className="emoji-grid" role="listbox" aria-label={t('emoji')}>
        {EMOJI[tab].split(' ').map((e) => (
          <button key={e} type="button" role="option" aria-selected="false" onClick={() => onPick(e)}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

export function EmojiSheet({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  return (
    <Sheet title={t('emoji')} onClose={onClose} cancel={t('done')} fit>
      <EmojiGrid onPick={onPick} />
    </Sheet>
  );
}

const hex = (h: number, s: number, l: number) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};
/** A row of greys, then twelve hues at five lightness steps. */
const COLORS = [
  ...Array.from({ length: 12 }, (_, i) => hex(0, 0, 1 - i / 11)),
  ...[0.82, 0.68, 0.54, 0.4, 0.28].flatMap((l) => Array.from({ length: 12 }, (_, i) => hex(i * 30, 0.85, l))),
];

export function ColorSheet({ value, onPick, onClose }: { value?: string; onPick: (color: string) => void; onClose: () => void }) {
  const [color, setColor] = useState(value ?? '');
  return (
    <Sheet title={t('colour')} onClose={onClose} action={{ label: t('done'), disabled: !color, run: () => onPick(color) }} fit>
      <div className="color-grid" role="listbox" aria-label={t('colour')}>
        {COLORS.map((c) => (
          <button key={c} role="option" aria-selected={c === color} aria-label={c} style={{ background: c }} onClick={() => setColor(c)} />
        ))}
      </div>
    </Sheet>
  );
}
