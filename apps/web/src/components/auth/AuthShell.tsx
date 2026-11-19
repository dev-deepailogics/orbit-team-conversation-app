import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff } from '@/components/ui/icons';
import { api } from '../../lib/api';
import { BrandPinwheel, Lockup, Wordmark } from '../brand/BrandMark';

// Figma 1:10556 · Sign in · Welcome. Colours come from the theme (globals.css :root before any theme loads).
const strongBorder = 'color-mix(in srgb, var(--theme-border) 80%, var(--theme-text-muted))';

export const authInputClass =
  'w-full h-11 rounded-[10px] border border-[color:var(--auth-border)] bg-[var(--theme-bg-app)] px-4 text-sm text-[var(--theme-text)] placeholder:text-[color:var(--auth-placeholder)] focus:outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[color:var(--auth-ring)] transition';

export const authLabelClass = 'block text-[13px] font-medium text-[var(--theme-text)] mb-1.5';

export const authButtonClass =
  'w-full h-[46px] rounded-[10px] bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-primary-text)] text-[15px] font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60';

export const authSecondaryButtonClass =
  'w-full h-11 rounded-[10px] border border-[color:var(--auth-border)] bg-[var(--theme-bg-app)] hover:bg-[var(--theme-bg-surface)] text-[var(--theme-text)] text-sm font-medium transition flex items-center justify-center gap-2';

export const authLinkClass = 'font-medium text-[var(--theme-primary)] hover:text-[var(--theme-primary-hover)] hover:underline';

/** Split brand panel + form shared by the login and register pages. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen flex"
      style={
        {
          backgroundColor: 'var(--theme-bg-app)',
          fontFamily: "var(--theme-font, 'Inter'), sans-serif",
          '--auth-border': strongBorder,
          '--auth-placeholder': 'color-mix(in srgb, var(--theme-text-muted) 65%, var(--theme-bg-app))',
          '--auth-ring': 'color-mix(in srgb, var(--theme-primary) 20%, transparent)',
        } as React.CSSProperties
      }
    >
      <Link
        href="/"
        aria-label="Back to home"
        title="Back to home"
        className="absolute z-10 top-4 left-4 sm:top-6 sm:left-6 w-9 h-9 rounded-full flex items-center justify-center border transition-colors text-[var(--theme-text-muted)] border-[color:var(--theme-border)] hover:text-[var(--theme-text)] lg:text-[var(--theme-primary-text)] lg:border-[color:color-mix(in_srgb,var(--theme-primary-text)_25%,transparent)] lg:hover:text-[var(--theme-primary-text)] lg:hover:bg-[color:color-mix(in_srgb,var(--theme-primary-text)_10%,transparent)]"
      >
        <ArrowLeft size={16} />
      </Link>

      {/* Brand panel */}
      <aside
        className="hidden lg:flex relative w-[640px] shrink-0 overflow-hidden flex-col items-center justify-center"
        style={{ backgroundColor: 'var(--theme-primary-hover)' }}
      >
        <div
          className="absolute left-[-120px] bottom-[-180px] w-[520px] h-[520px] rounded-full"
          style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary-text) 6%, transparent)' }}
        />
        <div
          className="absolute right-[-100px] top-[-140px] w-[420px] h-[420px] rounded-full"
          style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary-text) 7%, transparent)' }}
        />
        <div className="relative flex flex-col items-center translate-y-[-14px]">
          <BrandPinwheel size={170} variant="on-dark" />
          <div className="mt-[25px]">
            <Wordmark size={52} tracking={-1} color="var(--theme-primary-text)" />
          </div>
          <p className="mt-[58px] w-[480px] text-center text-[22px] font-semibold" style={{ color: 'var(--theme-primary-text)' }}>
            One orbit for chat, docs and boards.
          </p>
          <p
            className="mt-[15px] w-[400px] text-center text-[15px]"
            style={{ color: 'color-mix(in srgb, var(--theme-selected) 85%, transparent)' }}
          >
            Keep every conversation, document and ticket in one place.
          </p>
        </div>
      </aside>

      {/* Form */}
      <main className="flex-1 min-w-0 flex items-center justify-center px-4 py-16">
        <div className="w-[360px] max-w-full flex flex-col">
          <Link href="/" className="self-center" aria-label="Orbit home">
            <Lockup mark={57.6} />
          </Link>
          <h1 className="mt-[52px] text-center text-[30px] font-bold" style={{ color: 'var(--theme-text)' }}>
            {title}
          </h1>
          <p className="mt-2 mb-[38px] text-center text-[15px]" style={{ color: 'var(--theme-text-muted)' }}>
            {subtitle}
          </p>
          {children}
        </div>
      </main>
    </div>
  );
}

/** Password field with a show/hide eye toggle, styled to match authInputClass. */
export const AuthPasswordInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <input
          {...props}
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={`${authInputClass} pr-11 ${className || ''}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 transition text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    );
  },
);
AuthPasswordInput.displayName = 'AuthPasswordInput';

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="text-[13px] px-3 py-2.5 rounded-[10px] border mb-4"
      style={{
        backgroundColor: 'color-mix(in srgb, #DC2626 8%, transparent)',
        borderColor: 'color-mix(in srgb, #DC2626 30%, transparent)',
        color: '#DC2626',
      }}
    >
      {message}
    </div>
  );
}

/** "or" divider + Microsoft button (the only external provider the server supports). */
export function MicrosoftSignIn({ label = 'Continue with Microsoft' }: { label?: string }) {
  return (
    <>
      <div className="flex items-center gap-5 mt-[18px] mb-3">
        <div className="h-px flex-1" style={{ backgroundColor: 'var(--theme-border)' }} />
        <span className="text-[13px] leading-4" style={{ color: 'var(--theme-text-muted)' }}>
          or
        </span>
        <div className="h-px flex-1" style={{ backgroundColor: 'var(--theme-border)' }} />
      </div>

      <a href={`${api.defaults.baseURL}/api/auth/microsoft`} className={authSecondaryButtonClass}>
        {label}
      </a>
    </>
  );
}
