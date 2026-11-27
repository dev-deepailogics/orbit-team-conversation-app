'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, ChevronDown, Check } from '@/components/ui/icons';
import { DropdownSearch, NoMatches, matchesSearch } from '@/components/ui/DropdownSearch';
import { Avatar } from '../project/projectViewUtils';
import { Presence } from '../availability/useTeamPresence';

// Shared building blocks for the Figma "Modals" set (16px card, 24px gutters, tinted footer).

export const SUCCESS = '#1F9D63';
export const WARNING = '#D97706';
export const DANGER = '#DC2626';
export const STRONG_BORDER = 'color-mix(in srgb, var(--theme-text) 20%, transparent)';

export const inputClass =
  'w-full h-10 px-3 rounded-[10px] border text-sm bg-[var(--theme-bg-app)] border-[var(--theme-border)] text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] outline-none transition-[border-color,box-shadow] focus:border-[var(--theme-primary)] focus:shadow-[0_0_0_0.5px_var(--theme-primary)]';

/** Same look as inputClass for a wrapper that holds an icon + bare <input>. */
export const inputShellClass =
  'w-full h-10 px-3 flex items-center gap-2 rounded-[10px] border bg-[var(--theme-bg-app)] border-[var(--theme-border)] transition-[border-color,box-shadow] focus-within:border-[var(--theme-primary)] focus-within:shadow-[0_0_0_0.5px_var(--theme-primary)]';

export const bareInputClass =
  'flex-1 min-w-0 bg-transparent outline-none text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)]';

export const ModalShell: React.FC<{
  width: number;
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  onClose: () => void;
  onSubmit?: (e: React.FormEvent) => void;
  footer: React.ReactNode;
  footerAlign?: 'end' | 'between';
  children: React.ReactNode;
}> = ({ width, title, subtitle, icon, onClose, onSubmit, footer, footerAlign = 'end', children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const Body = onSubmit ? 'form' : 'div';
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
      style={{ backgroundColor: 'color-mix(in srgb, var(--theme-text) 45%, transparent)' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <Body
        {...(onSubmit ? { onSubmit } : {})}
        className="flex flex-col w-full max-h-[calc(100vh-32px)] overflow-hidden rounded-2xl animate-in zoom-in-95 duration-150"
        style={{
          maxWidth: width,
          backgroundColor: 'var(--theme-bg-app)',
          boxShadow: '0 2px 6px rgba(20, 26, 46, 0.08), 0 24px 48px rgba(20, 26, 46, 0.2)',
          color: 'var(--theme-text)',
        }}
      >
        <div className="shrink-0 flex items-start gap-3 px-6 pt-5 pb-4">
          {icon}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <h2 className="text-lg font-bold leading-6" style={{ color: 'var(--theme-text)' }}>
              {title}
            </h2>
            {subtitle && (
              <p className="text-[13px] leading-[18px]" style={{ color: 'var(--theme-text-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition hover:bg-[var(--theme-fill-hover)]"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto px-6 pb-5 flex flex-col gap-4">{children}</div>

        <div
          className={`shrink-0 border-t px-6 py-4 flex items-center gap-2 ${
            footerAlign === 'between' ? '' : 'justify-end'
          }`}
          style={{ backgroundColor: 'var(--theme-bg-surface)', borderColor: 'var(--theme-border)' }}
        >
          {footer}
        </div>
      </Body>
    </div>
  );
};

export const Field: React.FC<{
  label: string;
  optional?: boolean;
  help?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ label, optional, help, className = '', children }) => (
  <div className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
    <span className="flex items-center gap-1.5">
      <span className="text-[13px] font-semibold" style={{ color: 'var(--theme-text)' }}>
        {label}
      </span>
      {optional && (
        <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
          Optional
        </span>
      )}
    </span>
    {children}
    {help && (
      <p className="text-xs leading-4" style={{ color: 'var(--theme-text-muted)' }}>
        {help}
      </p>
    )}
  </div>
);

export const GroupLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
    {children}
  </p>
);

export const SecondaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...p }) => (
  <button
    type="button"
    {...p}
    className={`h-9 px-4 rounded-[10px] border flex items-center justify-center gap-1.5 text-sm font-semibold transition hover:bg-[var(--theme-fill-hover)] disabled:opacity-50 ${className}`}
    style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)', ...p.style }}
  />
);

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...p }) => (
  <button
    type="submit"
    {...p}
    className={`h-9 px-4 rounded-[10px] flex items-center justify-center gap-1.5 text-sm font-semibold transition hover:bg-[var(--theme-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--theme-primary)] ${className}`}
    style={{ color: 'var(--theme-primary-text)', ...p.style }}
  />
);

export const ErrorNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="rounded-[10px] px-3 py-2.5 text-[13px]"
    style={{ backgroundColor: `color-mix(in srgb, ${DANGER} 10%, transparent)`, color: DANGER }}
  >
    {children}
  </div>
);

export const Radio: React.FC<{ checked: boolean }> = ({ checked }) =>
  checked ? (
    <span className="w-[18px] h-[18px] rounded-full shrink-0 flex items-center justify-center bg-[var(--theme-primary)]">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--theme-primary-text)' }} />
    </span>
  ) : (
    <span
      className="w-[18px] h-[18px] rounded-full shrink-0 border-[1.5px]"
      style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: STRONG_BORDER }}
    />
  );

export const CheckboxBox: React.FC<{ checked: boolean }> = ({ checked }) =>
  checked ? (
    <span
      className="w-4 h-4 rounded shrink-0 flex items-center justify-center bg-[var(--theme-primary)]"
      style={{ color: 'var(--theme-primary-text)' }}
    >
      <Check size={11} />
    </span>
  ) : (
    <span
      className="w-4 h-4 rounded shrink-0 border-[1.5px]"
      style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: STRONG_BORDER }}
    />
  );

export const PersonChip: React.FC<{ name: string; avatarUrl?: string | null; onRemove: () => void }> = ({
  name,
  avatarUrl,
  onRemove,
}) => (
  <span
    className="h-7 pl-1 pr-1.5 rounded-[14px] flex items-center gap-1.5 shrink-0"
    style={{ backgroundColor: 'var(--theme-bg-surface-hover)' }}
  >
    <Avatar name={name} src={avatarUrl} size={20} />
    <span className="text-[13px] font-medium whitespace-nowrap" style={{ color: 'var(--theme-text)' }}>
      {name}
    </span>
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${name}`}
      className="rounded hover:opacity-70"
      style={{ color: 'var(--theme-text-muted)' }}
    >
      <X size={12} />
    </button>
  </span>
);

const PRESENCE_LOOK: Record<Presence, { color: string; ring: boolean; label: string }> = {
  working: { color: SUCCESS, ring: false, label: 'Available' },
  break: { color: WARNING, ring: false, label: 'Away' },
  offline: { color: 'var(--theme-text-muted)', ring: true, label: 'Offline' },
};

export const presenceLabel = (p?: Presence) => PRESENCE_LOOK[p ?? 'offline'].label;

/** Avatar with the Figma status badge (white plate, 10px status mark) at its bottom-right. */
export const PresenceAvatar: React.FC<{
  name: string;
  src?: string | null;
  size: number;
  presence?: Presence;
}> = ({ name, src, size, presence }) => {
  const look = PRESENCE_LOOK[presence ?? 'offline'];
  const plate = size >= 32 ? 12 : 11;
  const mark = plate - 2;
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <Avatar name={name} src={src} size={size} />
      <span
        className="absolute rounded-full flex items-center justify-center"
        style={{
          width: plate,
          height: plate,
          left: size - plate + 3,
          top: size - plate + 3,
          backgroundColor: 'var(--theme-bg-app)',
        }}
      >
        <span
          className="rounded-full"
          style={
            look.ring
              ? { width: mark, height: mark, border: `1.5px solid ${look.color}` }
              : { width: mark, height: mark, backgroundColor: look.color }
          }
        />
      </span>
    </span>
  );
};

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  leading?: React.ReactNode;
  /** Rendered in the closed trigger instead of leading + label (e.g. a priority pill). */
  display?: React.ReactNode;
}

/** Figma dropdown field: 40px input with leading visual, value and a chevron. */
export function SelectField<T extends string>({
  value,
  options,
  onChange,
  placeholder = 'Select',
  disabled,
  searchable,
  searchPlaceholder,
}: {
  value: T | '';
  options: SelectOption<T>[];
  onChange: (v: T) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Show a search box at the top of the list (for long lists such as people or projects). */
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const current = options.find((o) => o.value === value);
  const visibleOptions = searchable ? options.filter((o) => matchesSearch(o.label, query)) : options;
  const choose = (v: T) => {
    onChange(v);
    setOpen(false);
  };
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`${inputShellClass} text-left disabled:cursor-default ${open ? 'border-[var(--theme-primary)] shadow-[0_0_0_0.5px_var(--theme-primary)]' : ''}`}
      >
        {current ? (
          current.display ?? (
            <>
              {current.leading}
              <span className="truncate text-sm" style={{ color: 'var(--theme-text)' }}>
                {current.label}
              </span>
            </>
          )
        ) : (
          <span className="truncate text-sm" style={{ color: 'var(--theme-text-muted)' }}>
            {placeholder}
          </span>
        )}
        <span className="flex-1" />
        {!disabled && <ChevronDown size={16} style={{ color: 'var(--theme-text-muted)' }} />}
      </button>
      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-[60] max-h-60 overflow-y-auto rounded-xl border p-1 shadow-xl"
          style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)' }}
        >
          {searchable && (
            <DropdownSearch
              inset={1}
              value={query}
              onChange={setQuery}
              placeholder={searchPlaceholder}
              onEnter={() => visibleOptions[0] && choose(visibleOptions[0].value)}
              onEscape={() => setOpen(false)}
            />
          )}
          {searchable && visibleOptions.length === 0 && <NoMatches />}
          {visibleOptions.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => choose(o.value)}
              className="w-full h-9 px-2.5 rounded-lg flex items-center gap-2 text-left text-sm transition hover:bg-[var(--theme-fill-hover)]"
              style={{ color: 'var(--theme-text)' }}
            >
              {o.display ?? (
                <>
                  {o.leading}
                  <span className="truncate">{o.label}</span>
                </>
              )}
              <span className="flex-1" />
              {o.value === value && <Check size={14} style={{ color: 'var(--theme-primary)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
