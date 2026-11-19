'use client';

import React, { useState } from 'react';
import { Mask, Sparkles } from '@/components/ui/icons';
import { api } from '../../lib/api';
import {
  ModalShell,
  Field,
  SecondaryButton,
  PrimaryButton,
  ErrorNote,
  inputClass,
  WARNING,
} from './modalKit';

const ADJECTIVES = [
  'Thoughtful', 'Curious', 'Brave', 'Philosophical', 'Silent',
  'Clever', 'Wise', 'Dynamic', 'Calm', 'Bold',
  'Insightful', 'Wandering', 'Sharp', 'Serene', 'Vibrant',
  'Gentle', 'Honest', 'Mystic', 'Stealthy', 'Noble',
  'Creative', 'Keen', 'Radiant', 'Patient', 'Fearless',
  'Mindful', 'Pragmatic', 'Ingenious', 'Luminous', 'Harmonic',
];

const NOUNS = [
  'Owl', 'Falcon', 'Fox', 'Otter', 'Sage',
  'Beaver', 'Lynx', 'Badger', 'Phoenix', 'Dolphin',
  'Panda', 'Eagle', 'Cheetah', 'Wolf', 'Raven',
  'Sparrow', 'Hawk', 'Tiger', 'Bear', 'Koala',
  'Explorer', 'Voyager', 'Observer', 'Architect', 'Pioneer',
  'Navigator', 'Philosopher', 'Seeker', 'Strategist', 'Alchemist',
];

const POPULAR_EMOJIS = [
  '🦊', '🦉', '🎭', '🦁', '🐬', '🐼', '🦅', '🐺', '🐨', '🐯',
  '🦔', '🦦', '🦡', '🐙', '🦄', '🚀', '💡', '🌿', '⚡', '🔮',
  '🛡️', '🎯', '🧩', '🌊', '🔥', '🧭', '🎨', '🌙', '⭐', '🕊️',
  '🏔️', '🪐', '🍁', '🔭', '💎', '🕯️', '⛵', '🌈', '🗝️', '🛸',
];

function getRandomPersona() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const emoji = POPULAR_EMOJIS[Math.floor(Math.random() * POPULAR_EMOJIS.length)];
  return { name: `${adj} ${noun}`, emoji };
}

// Figma amber surfaces (#FFFBEB fill, #92400E text) expressed against the warning token.
const AMBER_FILL = `color-mix(in srgb, ${WARNING} 9%, var(--theme-bg-app))`;
const AMBER_TEXT = `color-mix(in srgb, ${WARNING} 70%, var(--theme-text))`;

interface AnonymousPersonaModalProps {
  isOpen?: boolean;
  channelId: string;
  channelName?: string;
  currentName?: string;
  currentEmoji?: string;
  onClose: () => void;
  onSaved?: (newProfile: { anonName: string; anonEmoji: string }) => void;
  onPersonaUpdated?: (newProfile: { anonName: string; anonEmoji: string }) => void;
}

export const AnonymousPersonaModal: React.FC<AnonymousPersonaModalProps> = ({
  isOpen = true,
  channelId,
  channelName = 'anonymous channel',
  currentName = 'Thoughtful Owl',
  currentEmoji = '🦉',
  onClose,
  onSaved,
  onPersonaUpdated,
}) => {
  const [anonName, setAnonName] = useState(currentName);
  const [anonEmoji, setAnonEmoji] = useState(currentEmoji);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isOpen === false) return null;

  const handleRollRandom = () => {
    const rolled = getRandomPersona();
    setAnonName(rolled.name);
    setAnonEmoji(rolled.emoji);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anonName.trim()) {
      setError('Name cannot be empty');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const res = await api.patch(`/api/channels/${channelId}/anonymous-profile`, {
        anonName: anonName.trim(),
        anonEmoji: anonEmoji.trim() || '🎭',
      });
      const updated = res.data?.anonProfile || res.data || { anonName: anonName.trim(), anonEmoji: anonEmoji.trim() || '🎭' };
      if (onSaved) onSaved(updated);
      if (onPersonaUpdated) onPersonaUpdated(updated);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update persona');
    } finally {
      setIsSaving(false);
    }
  };

  const feedName = channelName.startsWith('#') ? channelName : `#${channelName}`;

  return (
    <ModalShell
      width={480}
      title="Set your character name"
      subtitle={`You will post in ${feedName} under this name. Your real name stays hidden.`}
      icon={
        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: AMBER_FILL, color: WARNING }}
        >
          <Mask size={20} />
        </span>
      }
      onClose={onClose}
      onSubmit={handleSave}
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={isSaving}>
            Cancel
          </SecondaryButton>
          <PrimaryButton disabled={isSaving || !anonName.trim()}>
            {isSaving ? 'Saving…' : 'Confirm name'}
          </PrimaryButton>
        </>
      }
    >
      {/* Preview */}
      <div className="rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: AMBER_FILL }}>
        <span
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xl select-none"
          style={{ backgroundColor: 'var(--theme-bg-app)' }}
        >
          {anonEmoji}
        </span>
        <span className="flex flex-col min-w-0">
          <span className="text-sm font-bold leading-5 truncate" style={{ color: 'var(--theme-text)' }}>
            {anonName.trim() || 'Anonymous member'}
          </span>
          <span className="text-xs leading-4 truncate" style={{ color: AMBER_TEXT }}>
            How you will appear in {feedName}
          </span>
        </span>
      </div>

      <Field label="Character name" help="Pick a name others will recognize you by in this feed.">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              required
              autoFocus
              maxLength={40}
              placeholder="e.g. Philosophical Fox"
              value={anonName}
              onChange={(e) => setAnonName(e.target.value)}
              className={inputClass}
            />
            <SecondaryButton
              onClick={handleRollRandom}
              title="Generate a random name and icon"
              className="h-10 px-3 shrink-0"
            >
              <Sparkles size={14} />
              Random
            </SecondaryButton>
          </div>
        </div>
      </Field>

      <Field label="Icon">
        <div
          className="grid grid-cols-10 gap-1 rounded-[10px] border p-1.5 max-h-[104px] overflow-y-auto"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          {POPULAR_EMOJIS.map((emoji) => {
            const selected = anonEmoji === emoji;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => setAnonEmoji(emoji)}
                aria-label={`Use ${emoji}`}
                aria-pressed={selected}
                className="h-8 rounded-lg flex items-center justify-center text-lg transition hover:bg-[var(--theme-fill-hover)]"
                style={
                  selected
                    ? { backgroundColor: 'var(--theme-selected)', boxShadow: 'inset 0 0 0 1.5px var(--theme-primary)' }
                    : undefined
                }
              >
                {emoji}
              </button>
            );
          })}
        </div>
      </Field>

      {error && <ErrorNote>{error}</ErrorNote>}
    </ModalShell>
  );
};
