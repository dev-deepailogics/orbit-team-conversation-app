'use client';

import React, { useState } from 'react';
import { X, Sparkles, Check, Smile, ShieldAlert } from 'lucide-react';
import { api } from '../../lib/api';

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

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-[#1A1D21] border border-gray-700/80 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-[#16181B]">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎭</span>
            <div>
              <h2 className="text-sm font-bold text-white">Your Anonymous Persona</h2>
              <p className="text-[11px] text-gray-400">in #{channelName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Privacy Notice Banner */}
          <div className="flex items-start gap-2.5 bg-purple-950/30 border border-purple-800/40 rounded-xl p-3 text-xs text-purple-200">
            <ShieldAlert size={16} className="text-purple-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed text-[11px]">
              <strong className="text-purple-300 font-semibold block">Total Anonymity Protected</strong>
              Your real name, profile photo, and user ID are strictly hidden from all members in this channel.
            </div>
          </div>

          {/* Current Persona Preview Card */}
          <div className="flex items-center justify-between bg-[#222529] border border-gray-700/80 rounded-xl p-3.5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-900/60 to-indigo-900/60 border border-purple-500/40 flex items-center justify-center text-2xl shadow-inner select-none">
                {anonEmoji}
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400 block">
                  Current Identity
                </span>
                <span className="text-sm font-bold text-white truncate max-w-[180px] block">
                  {anonName || 'Anonymous Member'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRollRandom}
              title="Generate another meaningful name & emoji"
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#2C3136] hover:bg-[#383E44] text-xs font-semibold text-gray-200 rounded-lg border border-gray-600/50 transition active:scale-95"
            >
              <Sparkles size={13} className="text-yellow-400" />
              <span>Random</span>
            </button>
          </div>

          {/* Name Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
              Persona Name
            </label>
            <input
              type="text"
              required
              maxLength={40}
              placeholder="e.g. Philosophical Fox"
              value={anonName}
              onChange={(e) => setAnonName(e.target.value)}
              className="w-full bg-[#222529] border border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition"
            />
            <span className="text-[10px] text-gray-500 mt-1 block">
              You can choose any name or title you like for this discussion.
            </span>
          </div>

          {/* Emoji Selector Grid */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5 flex items-center gap-1">
              <Smile size={12} className="text-gray-400" />
              <span>Icon / Emoji</span>
            </label>
            <div className="grid grid-cols-10 gap-1.5 bg-[#222529] border border-gray-700/80 rounded-xl p-2.5 max-h-36 overflow-y-auto">
              {POPULAR_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setAnonEmoji(emoji)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition ${
                    anonEmoji === emoji
                      ? 'bg-purple-600/40 border border-purple-400 shadow-sm scale-110'
                      : 'hover:bg-gray-700/60'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg p-2.5">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition disabled:opacity-50 shadow-md shadow-purple-900/30"
            >
              <Check size={14} />
              <span>{isSaving ? 'Saving...' : 'Apply Persona'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
