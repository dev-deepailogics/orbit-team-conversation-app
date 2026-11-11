'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { SOCKET_EVENTS, UserAvailabilityRecord } from '@orbit/types';
import { Clock, Coffee, Play, LogOut, AlertTriangle, X } from 'lucide-react';

const BREAK_REASONS = [
  'Lunch',
  'Namaz',
  'Tea Break',
  'Personal',
  'Meeting / Discussion',
  'Other',
];

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
  const [selectedBreakReason, setSelectedBreakReason] = useState<string>(BREAK_REASONS[0]);
  const [customBreakReason, setCustomBreakReason] = useState<string>('');
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
    const reason = selectedBreakReason === 'Other' ? customBreakReason.trim() || 'Other' : selectedBreakReason;
    try {
      const res = await api.post('/api/availability/break/start', { reason });
      setAvailability(res.data.availability);
      setShowBreakModal(false);
      setCustomBreakReason('');
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

  const menuItem =
    'w-full px-3 py-2 rounded-lg text-[13px] font-medium flex items-center gap-2 text-left transition hover:bg-[var(--theme-bg-surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => (isAvailable ? setShowStatusDropdown((prev) => !prev) : handleCheckIn())}
          disabled={isActionLocked && !isAvailable}
          title={isOnBreak ? `On break · ${formattedTime}` : isAvailable ? `Working · ${formattedTime}` : 'Check in'}
          className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 hover:rounded-2xl select-none ${
            isOnBreak
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/50'
              : isAvailable
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : ''
          }`}
          style={isAvailable ? undefined : { backgroundColor: 'var(--theme-bg-surface)', color: 'var(--theme-text-primary)' }}
        >
          {isOnBreak && (
            <>
              <span className="absolute inset-0 rounded-[inherit] bg-amber-500/30 animate-glow pointer-events-none" />
              <span className="absolute inset-0 rounded-[inherit] border-2 border-amber-500 animate-ripple pointer-events-none" />
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

        {showStatusDropdown && isAvailable && (
          <div
            className="absolute left-full top-0 ml-3 z-50 w-40 rounded-xl p-1.5 shadow-2xl border border-[var(--theme-border)] text-[var(--theme-text)] animate-in fade-in zoom-in-95 duration-150"
            style={{ backgroundColor: 'var(--theme-bg-surface)' }}
          >
            {isOnBreak ? (
              <button
                type="button"
                disabled={isActionLocked}
                onClick={() => {
                  setShowStatusDropdown(false);
                  handleResumeWork();
                }}
                className={menuItem}
              >
                <Play size={15} className="text-emerald-500" /> Resume
              </button>
            ) : (
              <button
                type="button"
                disabled={isActionLocked}
                onClick={() => {
                  setShowStatusDropdown(false);
                  setShowBreakModal(true);
                }}
                className={menuItem}
              >
                <Coffee size={15} className="text-amber-500" /> Break
              </button>
            )}
            <button
              type="button"
              disabled={isActionLocked}
              onClick={() => {
                setShowStatusDropdown(false);
                handleRequestCheckout();
              }}
              className={`${menuItem} hover:text-rose-500`}
            >
              <LogOut size={15} /> Checkout
            </button>
          </div>
        )}
      </div>
      {/* Break Reason Modal */}
      {showBreakModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--theme-border)]">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
                <Coffee size={16} />
                <span>Select Break Reason</span>
              </div>
              <button
                onClick={() => setShowBreakModal(false)}
                className="p-1 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <label className="text-xs font-semibold text-[var(--theme-text)] block">
                Choose reason for your break:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {BREAK_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSelectedBreakReason(reason)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border text-left transition ${
                      selectedBreakReason === reason
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-300 font-bold'
                        : 'bg-[var(--theme-bg-surface-hover)] border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)]'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              {selectedBreakReason === 'Other' && (
                <input
                  type="text"
                  placeholder="Specify break reason..."
                  value={customBreakReason}
                  onChange={(e) => setCustomBreakReason(e.target.value)}
                  className="w-full mt-2 px-3 py-2 rounded-xl bg-[var(--theme-bg-app)] border border-[var(--theme-border)] text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-amber-500"
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowBreakModal(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
              >
                Cancel
              </button>
              <button
                onClick={handleStartBreak}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-lg"
              >
                Start Break
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout 8-Hour Warning Confirmation Modal */}
      {showCheckoutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--theme-bg-surface)] border border-amber-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-3 text-amber-600 dark:text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[var(--theme-text)]">Under 8 Hours Shift Warning</h4>
                <p className="text-xs text-[var(--theme-text-muted)]">Total active working time: {checkoutWarningHours} hours</p>
              </div>
            </div>

            <p className="text-xs text-[var(--theme-text)] leading-relaxed mb-5 bg-[var(--theme-bg-surface-hover)] border border-[var(--theme-border)] p-3 rounded-xl">
              Your total working hours are currently less than 8 hours. Are you sure you want to checkout and end your shift?
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowCheckoutConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--theme-text)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] transition"
              >
                Stay Checked In
              </button>
              <button
                onClick={executeCheckout}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-lg"
              >
                Yes, Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
