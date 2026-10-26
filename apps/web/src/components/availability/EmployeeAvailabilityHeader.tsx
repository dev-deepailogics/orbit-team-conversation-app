'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { SOCKET_EVENTS, UserAvailabilityRecord } from '@orbit/types';
import {
  Clock,
  Coffee,
  Play,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronDown,
} from 'lucide-react';

const BREAK_REASONS = [
  'Lunch',
  'Namaz',
  'Tea Break',
  'Personal',
  'Meeting / Discussion',
  'Other',
];

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

  // 2. Stopwatch calculation:
  // (Current Time - availableTime) - Sum(all break durations)
  useEffect(() => {
    if (!availability || !availability.isAvailable) {
      if (!availability?.isAvailable && availability?.totalWorkingMinutes) {
        setElapsedSeconds(availability.totalWorkingMinutes * 60);
      } else {
        setElapsedSeconds(0);
      }
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now() + serverTimeOffset;
      const startTime = new Date(availability.availableTime).getTime();

      // Sum all completed breaks in ms
      let totalBreakMs = 0;
      for (const b of availability.breaks || []) {
        const bStart = new Date(b.breakStartTime).getTime();
        const bEnd = b.availableAfterBreak ? new Date(b.availableAfterBreak).getTime() : now;
        totalBreakMs += Math.max(0, bEnd - bStart);
      }

      // If on break right now, pause calculation at the moment break started
      let totalWorkMs = 0;
      if (availability.isOnBreak) {
        // Find current open break
        const openBreak = (availability.breaks || []).find((b) => !b.availableAfterBreak);
        const freezeTime = openBreak ? new Date(openBreak.breakStartTime).getTime() : now;
        // Prior completed breaks
        let priorBreakMs = 0;
        for (const b of availability.breaks || []) {
          if (b.availableAfterBreak) {
            const bStart = new Date(b.breakStartTime).getTime();
            const bEnd = new Date(b.availableAfterBreak).getTime();
            priorBreakMs += Math.max(0, bEnd - bStart);
          }
        }
        totalWorkMs = Math.max(0, freezeTime - startTime - priorBreakMs);
      } else {
        totalWorkMs = Math.max(0, now - startTime - totalBreakMs);
      }

      setElapsedSeconds(Math.floor(totalWorkMs / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [availability, serverTimeOffset]);

  // Format hh:mm:ss
  const formattedTime = useMemo(() => {
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [elapsedSeconds]);

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

  return (
    <>
      {/* Top Header Availability Bar */}
      <div className="flex items-center">
        {/* Live Stopwatch / Timer Pill with Dropdown Trigger */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowStatusDropdown((prev) => !prev)}
            title="Click to change availability status"
            className={`px-3.5 py-1.5 rounded-xl text-[13px] font-mono font-bold flex items-center gap-2 border shadow-sm transition-all duration-150 cursor-pointer select-none active:scale-95 focus:outline-none ${
              isOnBreak
                ? 'bg-[#2A241C] text-[#F59E0B] border-[#F59E0B]/50 shadow-[0_0_12px_rgba(245,158,11,0.15)] animate-pulse'
                : isAvailable
                ? 'bg-[#152A22] text-[#10B981] border-[#10B981]/50 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                : 'bg-[#182334] text-[#38BDF8] border-[#38BDF8]/40 shadow-[0_0_12px_rgba(56,189,248,0.12)]'
            }`}
          >
            <Clock
              size={14}
              className={
                isOnBreak
                  ? 'text-[#F59E0B]'
                  : isAvailable
                  ? 'text-[#10B981]'
                  : 'text-[#38BDF8]'
              }
            />
            <span className="tracking-wide">{formattedTime}</span>
            <ChevronDown
              size={12}
              className={`transition-transform duration-200 opacity-60 ${
                showStatusDropdown ? 'rotate-180' : 'rotate-0'
              }`}
            />
          </button>

          {/* Availability Status Dropdown Menu (Strictly Matching Image 1 & User Screenshot) */}
          {showStatusDropdown && (
            <div
              className="absolute right-0 top-full mt-3 z-50 rounded-[28px] p-3 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] border border-[#2B303C] flex items-center gap-3.5 animate-in fade-in zoom-in-95 duration-150"
              style={{
                backgroundColor: '#191C24',
              }}
            >
              {/* Option 1: Available */}
              <button
                type="button"
                onClick={() => {
                  setShowStatusDropdown(false);
                  handleCheckIn();
                }}
                disabled={isAvailable || isActionLocked}
                className={`h-14 px-5 rounded-[18px] text-[15px] font-semibold flex items-center gap-2.5 transition duration-150 shrink-0 select-none ${
                  isAvailable && !isOnBreak
                    ? 'bg-[#007A5A] text-white border-2 border-[#00B074] shadow-[0_0_15px_rgba(0,176,116,0.3)] cursor-default'
                    : !isAvailable
                    ? 'bg-[#007A5A] text-white border-2 border-[#00B074] hover:brightness-110 active:scale-95 cursor-pointer shadow-[0_0_15px_rgba(0,176,116,0.3)]'
                    : 'bg-[#262B36] text-[#6B7280] cursor-not-allowed border border-white/5 opacity-50'
                }`}
              >
                <Play size={16} className="text-white fill-transparent" strokeWidth={2.5} />
                <span className="font-medium tracking-tight">Available</span>
              </button>

              {/* Option 2: Break */}
              <button
                type="button"
                onClick={() => {
                  setShowStatusDropdown(false);
                  setShowBreakModal(true);
                }}
                disabled={!isAvailable || isOnBreak || isActionLocked}
                className={`h-14 px-5 rounded-[18px] text-[15px] font-semibold flex items-center gap-2.5 transition duration-150 shrink-0 select-none ${
                  isOnBreak
                    ? 'bg-[#2E281C] text-[#F59E0B] border-2 border-[#F59E0B] cursor-default'
                    : isAvailable
                    ? 'bg-[#262B36] hover:bg-[#313745] text-[#D1D5DB] border border-white/5 active:scale-95 cursor-pointer'
                    : 'bg-[#262B36] text-[#6B7280] cursor-not-allowed border border-white/5 opacity-50'
                }`}
              >
                <Coffee size={16} className="text-[#D1D5DB]" strokeWidth={2.2} />
                <span className="font-medium tracking-tight">Break</span>
              </button>

              {/* Option 3: Available after Break */}
              <button
                type="button"
                onClick={() => {
                  setShowStatusDropdown(false);
                  handleResumeWork();
                }}
                disabled={!isOnBreak || isActionLocked}
                className={`h-14 px-4 rounded-[18px] text-[14px] font-medium flex items-center justify-center gap-2 text-center leading-tight transition duration-150 shrink-0 select-none ${
                  isOnBreak
                    ? 'bg-[#007A5A] hover:bg-[#00916B] text-white border-2 border-[#00B074] shadow-[0_0_15px_rgba(0,176,116,0.3)] active:scale-95 cursor-pointer animate-pulse'
                    : 'bg-[#222733] text-[#555E6D] cursor-not-allowed border border-white/5 opacity-90'
                }`}
              >
                <div className="w-3.5 h-3.5 rounded-full border border-dashed border-[#555E6D] flex items-center justify-center shrink-0">
                  <div className="w-1 h-1 rounded-full bg-[#555E6D]" />
                </div>
                <div className="flex flex-col items-center justify-center leading-4 text-center">
                  <span>Available</span>
                  <span>after</span>
                  <span className="text-[13px]">Break</span>
                </div>
              </button>

              {/* Option 4: Checkout */}
              <button
                type="button"
                onClick={() => {
                  setShowStatusDropdown(false);
                  handleRequestCheckout();
                }}
                disabled={!isAvailable || isOnBreak || isActionLocked}
                className={`h-14 px-6 rounded-[18px] text-[15px] font-medium flex items-center gap-2 transition duration-150 shrink-0 select-none ${
                  isAvailable && !isOnBreak
                    ? 'bg-[#262B36] hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-500/40 text-[#D1D5DB] border border-white/5 active:scale-95 cursor-pointer'
                    : 'bg-[#262B36] text-[#6B7280] cursor-not-allowed border border-white/5 opacity-50'
                }`}
              >
                <span className="font-medium tracking-tight">Checkout</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Break Reason Modal */}
      {showBreakModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1C2026] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Coffee size={16} />
                <span>Select Break Reason</span>
              </div>
              <button
                onClick={() => setShowBreakModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <label className="text-xs font-semibold text-slate-300 block">
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
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
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
                  className="w-full mt-2 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowBreakModal(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
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
          <div className="bg-[#1C2026] border border-amber-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Under 8 Hours Shift Warning</h4>
                <p className="text-xs text-slate-400">Total active working time: {checkoutWarningHours} hours</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-5 bg-white/5 border border-white/5 p-3 rounded-xl">
              Your total working hours are currently less than 8 hours. Are you sure you want to checkout and end your shift?
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowCheckoutConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 transition"
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
