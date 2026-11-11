import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../lib/api';

export const authInputClass =
  'w-full bg-[#0a1226]/80 border border-white/15 rounded-xl px-4 py-3.5 text-[15px] text-white placeholder-slate-500 focus:outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20 transition';

export const authLabelClass = 'block text-sm font-medium text-slate-100 mb-2';

export const authButtonClass =
  'w-full py-3.5 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 border border-sky-400/60 shadow-[0_8px_30px_-8px_rgba(14,165,233,0.6)] text-white font-medium text-base transition flex items-center justify-center gap-2.5 disabled:opacity-50';

/** Dark, branded frame shared by the login and register pages. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen flex flex-col justify-center items-center px-4 py-20 overflow-hidden bg-[#06112b]"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 60% 50% at 0% 0%, rgba(37,99,235,0.45), transparent 70%), radial-gradient(ellipse 45% 40% at 100% 100%, rgba(37,99,235,0.4), transparent 70%)',
      }}
    >
      <Link
        href="/"
        aria-label="Back to home"
        title="Back to home"
        className="absolute top-4 left-4 sm:top-6 sm:left-6 w-9 h-9 rounded-full flex items-center justify-center border border-white/15 hover:border-white/30 bg-white/5 text-slate-200 transition-colors"
      >
        <ArrowLeft size={16} />
      </Link>

      <div className="w-full max-w-[520px] rounded-3xl border border-white/15 bg-gradient-to-b from-[#16264a]/70 to-[#0c1733]/80 backdrop-blur-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] px-6 py-8 sm:px-10 sm:py-10">
        <Link href="/" className="flex items-center justify-center gap-1 mb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/orbit-mark.png" alt="" className="w-16 h-16 sm:w-20 sm:h-20 object-contain" />
          <span className="text-5xl sm:text-6xl font-semibold text-white tracking-tight">ørbit</span>
        </Link>

        <h1 className="text-2xl sm:text-[28px] font-semibold text-center text-white mb-2">{title}</h1>
        <p className="text-sm sm:text-[15px] text-slate-400 text-center mb-8">{subtitle}</p>

        {children}
      </div>
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm p-3 rounded-xl mb-5">
      {message}
    </div>
  );
}

/** "Or continue with" divider + Microsoft button. */
export function MicrosoftSignIn({ label = 'Sign in with Microsoft' }: { label?: string }) {
  return (
    <>
      <div className="flex items-center gap-4 my-6">
        <div className="h-px flex-1 bg-white/15" />
        <span className="text-sm text-slate-400">Or continue with</span>
        <div className="h-px flex-1 bg-white/15" />
      </div>

      <a
        href={`${api.defaults.baseURL}/api/auth/microsoft`}
        className="w-full py-3.5 rounded-xl border border-white/20 hover:border-white/35 bg-white/[0.03] hover:bg-white/[0.06] text-white font-medium text-base transition flex items-center justify-center gap-3"
      >
        <svg width="20" height="20" viewBox="0 0 21 21" aria-hidden="true">
          <rect x="1" y="1" width="9" height="9" fill="#f25022" />
          <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
          <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
          <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
        </svg>
        <span>{label}</span>
      </a>
    </>
  );
}
