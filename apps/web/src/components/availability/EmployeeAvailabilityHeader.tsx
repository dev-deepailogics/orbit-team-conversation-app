'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { SOCKET_EVENTS, UserAvailabilityRecord } from '@orbit/types';
import { Clock, Coffee, AlertTriangle, Check, ChevronRight } from '@/components/ui/icons';
import { EmojiPickerPopover } from '../chat/EmojiPickerPopover';
import { useEmojiSuggestions } from './useEmojiSuggestions';
import {
  BREAK_PRESETS,
  DEFAULT_CUSTOM_EMOJI,
  OTHER_REASON,
  formatBreakReason,
  parseBreakReason,
} from './breakStatus';

// Semantic presence colours from the Figma guideline (fixed across themes)
const WORKING = '#1F9D63';
const BREAK = '#D97706';
const tint = (c: string, pct = 14) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;


// 45s → 12m → 1h 23m
export const formatElapsed = (secs: number) => {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
};

export const EmployeeAvailabilityHeader: React.FC<{
  currentUserId?: string;
}> = ({ currentUserId }) => {
  const [availability, setAvailability] = useState<UserAvailabilityRecord | null>(null);
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isActionLocked, setIsActionLocked] = useState<boolean>(false);

  // Modals
  const [showBreakModal, setShowBreakModal] = useState<boolean>(false);
  const [selectedBreakReason, setSelectedBreakReason] = useState<string>(BREAK_PRESETS[0].label);
  const [customBreakReason, setCustomBreakReason] = useState<string>('');
  // null = follow the top keyword suggestion; set once the user picks an emoji themselves.
  const [pickedEmoji, setPickedEmoji] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const isOtherReason = selectedBreakReason === OTHER_REASON;
  const emojiSuggestions = useEmojiSuggestions(customBreakReason, isOtherReason && showBreakModal);
  const customEmoji = pickedEmoji ?? emojiSuggestions[0] ?? DEFAULT_CUSTOM_EMOJI;
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState<boolean>(false);
  const [checkoutWarningHours, setCheckoutWarningHours] = useState<string>('0');

  const [showStatusDropdown, setShowStatusDropdown] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const actionLockTimer = useRef<NodeJS.Timeout | null>(null);

  // Close status dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowStatusDropdown(false);
      }
    };
    if (showStatusDropdown) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showStatusDropdown]);

  // Lock action buttons to prevent double-clicks
  const lockActions = () => {
    setIsActionLocked(true);
    if (actionLockTimer.current) clearTimeout(actionLockTimer.current);
    actionLockTimer.current = setTimeout(() => {
      setIsActionLocked(false);
    }, 2000);
  };

  // 1. Fetch current availability status on load
  const loadAvailability = async () => {
    try {
      const res = await api.get('/api/availability/current');
      const serverTime = new Date(res.data.serverTime).getTime();
      const localTime = Date.now();
      setServerTimeOffset(serverTime - localTime);
      setAvailability(res.data.availability);
    } catch (err) {
      console.error('Failed to load availability:', err);
    }
  };

  useEffect(() => {
    loadAvailability();

    // Listen to real-time socket events
    const socket = getSocket();
    const handleUpdate = (payload: { userId: string; availability: UserAvailabilityRecord }) => {
      if (payload.userId === currentUserId) {
        setAvailability(payload.availability);
      }
    };

    socket.on(SOCKET_EVENTS.AVAILABILITY_UPDATE, handleUpdate);
    return () => {
      socket.off(SOCKET_EVENTS.AVAILABILITY_UPDATE, handleUpdate);
      if (actionLockTimer.current) clearTimeout(actionLockTimer.current);
    };
  }, [currentUserId]);

  // 2. Stopwatch: (now - availableTime) - sum(breaks, open break counted up to now).
  // While on break both terms grow equally, so the value stays frozen.
  useEffect(() => {
    if (!availability?.isAvailable) {
      setElapsedSeconds(0);
      return;
    }
    const tick = () => {
      const now = Date.now() + serverTimeOffset;
      let breakMs = 0;
      for (const b of availability.breaks || []) {
        const end = b.availableAfterBreak ? new Date(b.availableAfterBreak).getTime() : now;
        breakMs += Math.max(0, end - new Date(b.breakStartTime).getTime());
      }
      const workMs = now - new Date(availability.availableTime).getTime() - breakMs;
      setElapsedSeconds(Math.max(0, Math.floor(workMs / 1000)));
    };
    tick();
    if (availability.isOnBreak) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [availability, serverTimeOffset]);

  const formattedTime = formatElapsed(elapsedSeconds);
  // 3. User Actions
  const handleCheckIn = async () => {
    if (isActionLocked) return;
    lockActions();
    try {
      const res = await api.post('/api/availability/checkin');
      setAvailability(res.data.availability);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to check in');
    }
  };

  const handleStartBreak = async () => {
    if (isActionLocked) return;
    lockActions();
    const note = customBreakReason.trim();
    const preset = BREAK_PRESETS.find((p) => p.label === selectedBreakReason) ?? BREAK_PRESETS[0];
    const reason = isOtherReason
      ? formatBreakReason(customEmoji, note || OTHER_REASON)
      : formatBreakReason(preset.emoji, note ? `${preset.label} · ${note}` : preset.label);
    try {
      const res = await api.post('/api/availability/break/start', { reason });
      setAvailability(res.data.availability);
      setShowBreakModal(false);
      setCustomBreakReason('');
      setPickedEmoji(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to start break');
    }
  };

  const handleResumeWork = async () => {
    if (isActionLocked) return;
    lockActions();
    try {
      const res = await api.post('/api/availability/break/resume');
      setAvailability(res.data.availability);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to resume work');
    }
  };

  const handleRequestCheckout = () => {
    if (isActionLocked) return;
    const workingHours = elapsedSeconds / 3600;
    if (workingHours < 8) {
      setCheckoutWarningHours(workingHours.toFixed(1));
      setShowCheckoutConfirm(true);
    } else {
      executeCheckout();
    }
  };

  const executeCheckout = async () => {
    lockActions();
    try {
      const res = await api.post('/api/availability/checkout');
      setAvailability(res.data.availability);
      setShowCheckoutConfirm(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to checkout');
    }
  };

  // State conditions
  const isAvailable = availability?.isAvailable ?? false;
  const isOnBreak = availability?.isOnBreak ?? false;

  const closeMenus = () => {
    setShowStatusDropdown(false);
    setShowBreakModal(false);
  };

  const lastBreak = (availability?.breaks || []).slice(-1)[0];
  const lastBreakStatus = lastBreak ? parseBreakReason(lastBreak.breakReason) : null;

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => (isAvailable ? setShowStatusDropdown((prev) => !prev) : handleCheckIn())}
          disabled={isActionLocked && !isAvailable}
          title={isOnBreak ? `On break · ${formattedTime}` : isAvailable ? `Working · ${formattedTime}` : 'Check in'}
          className="relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 hover:rounded-2xl select-none"
          style={
            isOnBreak
              ? { backgroundColor: tint(BREAK, 15), color: BREAK, boxShadow: `0 0 0 1px ${tint(BREAK, 50)}` }
              : isAvailable
              ? { backgroundColor: tint(WORKING, 15), color: WORKING }
              : { backgroundColor: 'var(--theme-fill)', color: 'var(--theme-text-muted)' }
          }
        >
          {isOnBreak && (
            <>
              <span className="absolute inset-0 rounded-[inherit] animate-glow pointer-events-none" style={{ backgroundColor: tint(BREAK, 30) }} />
              <span className="absolute inset-0 rounded-[inherit] border-2 animate-ripple pointer-events-none" style={{ borderColor: BREAK }} />
            </>
          )}
          {isAvailable ? (
            <span className="relative flex flex-col items-center text-[11px] leading-[13px] font-semibold tabular-nums tracking-tight">
              {formattedTime.split(' ').map((part) => <span key={part}>{part}</span>)}
            </span>
          ) : (
            <Clock size={20} />
          )}
        </button>

        {(showStatusDropdown || showBreakModal) && isAvailable && (
          <div className="absolute left-full bottom-0 ml-3 z-50 flex items-end gap-2 animate-in fade-in zoom-in-95 duration-150">
            {/* Status menu */}
            <div
              className="w-[288px] rounded-[14px] border p-2 flex flex-col gap-0.5"
              style={{
                backgroundColor: 'var(--theme-bg-app)',
                borderColor: 'var(--theme-border)',
                boxShadow: '0 12px 16px rgba(20, 26, 46, 0.2)',
              }}
            >
              <StatusOption
                icon="/icons/status-on.svg"
                title="Available"
                subtitle={isOnBreak ? 'Resume work and go back online' : `Reachable and online · ${formattedTime}`}
                selected={!isOnBreak}
                disabled={isActionLocked}
                onClick={() => {
                  if (!isOnBreak) return;
                  closeMenus();
                  handleResumeWork();
                }}
              />
              <StatusOption
                icon="/icons/status-away.svg"
                title="Break"
                subtitle={isOnBreak ? `On break${lastBreakStatus ? ` · ${lastBreakStatus.emoji} ${lastBreakStatus.text}` : ''}` : 'Pause notifications for a while'}
                selected={isOnBreak}
                expanded={!isOnBreak && showBreakModal}
                trailing={isOnBreak ? undefined : 'chevron'}
                disabled={isActionLocked}
                onClick={() => {
                  if (!isOnBreak) setShowBreakModal((v) => !v);
                }}
              />
              <StatusOption
                icon="/icons/status-off.svg"
                title="Checkout"
                subtitle="Done for the day · notifications off"
                disabled={isActionLocked}
                onClick={() => {
                  closeMenus();
                  handleRequestCheckout();
                }}
              />
            </div>

            {/* Break options */}
            {showBreakModal && !isOnBreak && (
              <div
                className="w-[300px] rounded-[14px] border p-4 flex flex-col gap-3"
                style={{
                  backgroundColor: 'var(--theme-bg-app)',
                  borderColor: 'var(--theme-border)',
                  boxShadow: '0 12px 16px rgba(20, 26, 46, 0.2)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: tint(BREAK, 16), color: BREAK }}>
                    <Coffee size={16} />
                  </span>
                  <span className="text-[15px] font-bold" style={{ color: 'var(--theme-text)' }}>
                    Take a break
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  {BREAK_PRESETS.map(({ label, emoji }) => {
                    const on = selectedBreakReason === label;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setSelectedBreakReason(label)}
                        className={`w-full h-[38px] px-3 rounded-[10px] border flex items-center gap-2.5 text-left text-sm transition ${
                          on ? 'font-semibold' : 'font-medium hover:bg-[var(--theme-fill-hover)]'
                        }`}
                        style={{
                          backgroundColor: on ? tint(BREAK, 16) : 'var(--theme-bg-app)',
                          borderColor: on ? BREAK : 'var(--theme-border)',
                          color: 'var(--theme-text)',
                        }}
                      >
                        <span
                          className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                          style={{ borderColor: on ? BREAK : 'var(--theme-border)' }}
                        >
                          {on && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BREAK }} />}
                        </span>
                        <span className="text-base leading-none" aria-hidden>
                          {label === OTHER_REASON ? customEmoji : emoji}
                        </span>
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="break-reason-input" className="text-xs font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
                    {selectedBreakReason === OTHER_REASON ? 'Break reason' : 'Custom message (optional)'}
                  </label>
                  <div className="relative flex items-center gap-1.5">
                    {isOtherReason && (
                      <>
                        <button
                          type="button"
                          title="Choose an emoji"
                          aria-label="Choose an emoji"
                          onClick={() => setShowEmojiPicker((v) => !v)}
                          className="w-10 h-10 shrink-0 rounded-[10px] border text-lg flex items-center justify-center transition hover:bg-[var(--theme-fill-hover)]"
                          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-app)' }}
                        >
                          {customEmoji}
                        </button>
                        <EmojiPickerPopover
                          isOpen={showEmojiPicker}
                          onClose={() => setShowEmojiPicker(false)}
                          onSelectEmoji={setPickedEmoji}
                          title="Status emoji"
                          positionClass="bottom-full left-0 mb-2"
                        />
                      </>
                    )}
                    <input
                      id="break-reason-input"
                      type="text"
                      value={customBreakReason}
                      onChange={(e) => setCustomBreakReason(e.target.value)}
                      placeholder={selectedBreakReason === OTHER_REASON ? 'Specify break reason' : 'Back in 30 minutes'}
                      className="flex-1 min-w-0 h-10 px-3 rounded-[10px] border text-sm outline-none focus:border-[var(--theme-primary)] placeholder:text-[var(--theme-text-muted)]"
                      style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text)', backgroundColor: 'var(--theme-bg-app)' }}
                    />
                  </div>

                  {isOtherReason && emojiSuggestions.length > 0 && (
                    <div className="flex items-center gap-1" role="listbox" aria-label="Suggested emojis">
                      <span className="text-[11px] font-semibold mr-1" style={{ color: 'var(--theme-text-muted)' }}>
                        Suggested
                      </span>
                      {emojiSuggestions.map((emoji) => {
                        const on = emoji === customEmoji;
                        return (
                          <button
                            key={emoji}
                            type="button"
                            role="option"
                            aria-selected={on}
                            onClick={() => setPickedEmoji(emoji)}
                            className="w-8 h-8 rounded-lg border text-base flex items-center justify-center transition hover:bg-[var(--theme-fill-hover)]"
                            style={{
                              borderColor: on ? BREAK : 'transparent',
                              backgroundColor: on ? tint(BREAK, 16) : 'transparent',
                            }}
                          >
                            {emoji}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBreakModal(false)}
                    className="flex-1 h-9 px-[14px] rounded-[18px] border text-[13px] font-medium transition hover:bg-[var(--theme-fill-hover)]"
                    style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-app)', color: 'var(--theme-text)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isActionLocked}
                    onClick={async () => {
                      await handleStartBreak();
                      setShowStatusDropdown(false);
                    }}
                    className="flex-1 h-9 px-4 rounded-[18px] flex items-center justify-center gap-1.5 text-[13px] font-semibold transition hover:brightness-95 disabled:opacity-50"
                    style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
                  >
                    <Coffee size={15} />
                    Start break
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Checkout 8-hour warning */}
      {showCheckoutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div
            className="w-full max-w-md rounded-2xl border p-6 flex flex-col gap-4 shadow-2xl"
            style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)' }}
          >
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: tint(BREAK, 16), color: BREAK }}>
                <AlertTriangle size={20} />
              </span>
              <div>
                <h4 className="text-[15px] font-bold" style={{ color: 'var(--theme-text)' }}>
                  Under 8 hours shift
                </h4>
                <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                  Total active working time: {checkoutWarningHours} hours
                </p>
              </div>
            </div>
            <p className="text-[13px] leading-[19px] rounded-[10px] p-3" style={{ backgroundColor: 'var(--theme-bg-surface)', color: 'var(--theme-text)' }}>
              Your total working hours are currently less than 8 hours. Are you sure you want to checkout and end your shift?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowCheckoutConfirm(false)}
                className="h-9 px-[14px] rounded-[18px] border text-[13px] font-medium transition hover:bg-[var(--theme-fill-hover)]"
                style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
              >
                Stay checked in
              </button>
              <button
                onClick={executeCheckout}
                className="h-9 px-4 rounded-[18px] text-[13px] font-semibold text-white transition hover:brightness-95"
                style={{ backgroundColor: '#DC2626' }}
              >
                Yes, checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const StatusOption: React.FC<{
  icon: string;
  title: string;
  subtitle: string;
  selected?: boolean;
  expanded?: boolean;
  trailing?: 'chevron';
  disabled?: boolean;
  onClick: () => void;
}> = ({ icon, title, subtitle, selected, expanded, trailing, disabled, onClick }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`w-full h-11 px-2.5 rounded-[10px] flex items-center gap-2.5 text-left transition disabled:opacity-50 ${
      selected ? '' : 'hover:bg-[var(--theme-fill-hover)]'
    }`}
    style={{ backgroundColor: selected || expanded ? 'var(--theme-selected)' : undefined }}
  >
    <img src={icon} alt="" width={14} height={14} className="shrink-0" />
    <span className="flex-1 min-w-0 flex flex-col">
      <span
        className={`text-sm ${selected ? 'font-bold' : 'font-medium'}`}
        style={{ color: selected ? 'var(--theme-primary-hover)' : 'var(--theme-text)' }}
      >
        {title}
      </span>
      <span className="text-[11px] truncate" style={{ color: 'var(--theme-text-muted)' }}>
        {subtitle}
      </span>
    </span>
    {selected && <Check size={16} style={{ color: 'var(--theme-primary-hover)' }} />}
    {trailing === 'chevron' && <ChevronRight size={14} style={{ color: 'var(--theme-text-muted)' }} />}
  </button>
);
