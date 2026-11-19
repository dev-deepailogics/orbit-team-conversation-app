'use client';

import React from 'react';

export const SUCCESS = '#1F9D63';
export const WARNING = '#D97706';
export const DANGER = '#DC2626';

export const tint = (color: string, pct = 14) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;
export const onTint = (color: string, pct = 70) => `color-mix(in srgb, ${color} ${pct}%, var(--theme-text))`;

export const cardShadow = '0 1px 1px rgba(20, 26, 46, 0.06)';

export const PageHeader: React.FC<{
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  bordered?: boolean;
}> = ({ title, subtitle, actions, bordered = true }) => (
  <div
    className={`shrink-0 flex items-center gap-4 pt-6 pb-4 px-8 ${bordered ? 'border-b' : ''}`}
    style={{ borderColor: 'var(--theme-border)' }}
  >
    <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
      <h2 className="text-[22px] leading-7 font-bold truncate" style={{ color: 'var(--theme-text)' }}>
        {title}
      </h2>
      <p className="text-[13px] truncate" style={{ color: 'var(--theme-text-muted)' }}>
        {subtitle}
      </p>
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export const Card: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({
  children,
  className = '',
  style,
}) => (
  <section
    className={`w-full rounded-[14px] border p-5 flex flex-col gap-3.5 ${className}`}
    style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)', boxShadow: cardShadow, ...style }}
  >
    {children}
  </section>
);

export const CardTitle: React.FC<{ title: string; subtitle?: string; right?: React.ReactNode }> = ({
  title,
  subtitle,
  right,
}) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex flex-col gap-0.5 min-w-0">
      <h3 className="text-[15px] font-bold" style={{ color: 'var(--theme-text)' }}>
        {title}
      </h3>
      {subtitle && (
        <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
          {subtitle}
        </p>
      )}
    </div>
    {right}
  </div>
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode };

export const OutlineButton: React.FC<ButtonProps> = ({ icon, children, className = '', style, ...rest }) => (
  <button
    type="button"
    {...rest}
    className={`h-9 px-3.5 rounded-[18px] border flex items-center justify-center gap-1.5 text-[13px] font-medium whitespace-nowrap transition hover:bg-[var(--theme-fill-hover)] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)', ...style }}
  >
    {icon}
    {children}
  </button>
);

export const PrimaryButton: React.FC<ButtonProps> = ({ icon, children, className = '', style, ...rest }) => (
  <button
    type="button"
    {...rest}
    className={`h-9 px-4 rounded-[18px] flex items-center justify-center gap-1.5 text-[13px] font-semibold whitespace-nowrap transition hover:bg-[var(--theme-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)', ...style }}
  >
    {icon}
    {children}
  </button>
);

export const SettingRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}> = ({ icon, title, subtitle, action }) => (
  <div
    className="w-full rounded-xl border p-3 flex items-center gap-3"
    style={{ backgroundColor: 'var(--theme-bg-surface)', borderColor: 'var(--theme-border)' }}
  >
    <span
      className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
      style={{ backgroundColor: 'var(--theme-bg-app)', color: 'var(--theme-text-muted)' }}
    >
      {icon}
    </span>
    <div className="flex-1 min-w-0 flex flex-col">
      <p className="text-sm font-semibold truncate" style={{ color: 'var(--theme-text)' }}>
        {title}
      </p>
      <p className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>
        {subtitle}
      </p>
    </div>
    {action}
  </div>
);

/** Centered dialog matching the Figma modal spec (white card, 16px radius, header/body/footer). */
export const DialogFrame: React.FC<{
  width: number;
  onClose: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  closeIcon: React.ReactNode;
  children: React.ReactNode;
  footer: React.ReactNode;
}> = ({ width, onClose, icon, title, subtitle, closeIcon, children, footer }) => (
  <div
    data-settings-popover
    className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-150"
    style={{ backgroundColor: 'color-mix(in srgb, var(--theme-text) 45%, transparent)' }}
    onMouseDown={(e) => e.target === e.currentTarget && onClose()}
  >
    <div
      className="w-full rounded-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
      style={{
        maxWidth: width,
        backgroundColor: 'var(--theme-bg-app)',
        boxShadow: '0 2px 6px rgba(20, 26, 46, 0.08), 0 24px 48px rgba(20, 26, 46, 0.2)',
      }}
    >
      <div className="flex items-start gap-3 pt-5 pb-4 px-6">
        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--theme-selected)', color: 'var(--theme-primary-hover)' }}
        >
          {icon}
        </span>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <h3 className="text-lg leading-6 font-bold" style={{ color: 'var(--theme-text)' }}>
            {title}
          </h3>
          <p className="text-[13px] leading-[18px]" style={{ color: 'var(--theme-text-muted)' }}>
            {subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition hover:bg-[var(--theme-fill-hover)]"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          {closeIcon}
        </button>
      </div>
      <div className="flex flex-col gap-4 pb-5 px-6">{children}</div>
      <div
        className="flex items-center justify-end gap-2 px-6 py-4 border-t"
        style={{ backgroundColor: 'var(--theme-bg-surface)', borderColor: 'var(--theme-border)' }}
      >
        {footer}
      </div>
    </div>
  </div>
);

export const DialogButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }> = ({
  primary,
  className = '',
  style,
  ...rest
}) => (
  <button
    {...rest}
    className={`h-9 px-4 rounded-[10px] text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
      primary ? 'hover:bg-[var(--theme-primary-hover)]' : 'border hover:bg-[var(--theme-fill-hover)]'
    } ${className}`}
    style={
      primary
        ? { backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)', ...style }
        : { backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)', ...style }
    }
  />
);
