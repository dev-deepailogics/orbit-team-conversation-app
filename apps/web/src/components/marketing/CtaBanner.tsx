'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Terminal, ArrowRight, Github, Sparkles, ShieldCheck } from 'lucide-react';

export function CtaBanner() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="relative rounded-3xl p-8 sm:p-16 overflow-hidden bg-gradient-to-b from-indigo-950/70 via-zinc-950/90 to-zinc-950 border border-indigo-500/30 shadow-2xl text-center">
          {/* Ambient animated aurora orbs */}
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-r from-indigo-500/25 via-cyan-400/20 to-purple-500/20 blur-3xl pointer-events-none rounded-full" />
          <div className="absolute -bottom-24 left-1/4 w-[350px] h-[200px] bg-indigo-600/20 blur-3xl pointer-events-none rounded-full" />

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-mono mb-6">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>COMMUNITY EDITION IS 100% FREE</span>
          </div>

          <h2 className="font-display font-black text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight max-w-4xl mx-auto leading-tight">
            Take back control of your team’s communication today
          </h2>

          <p className="mt-6 mb-8 text-base sm:text-xl text-zinc-300 max-w-2xl mx-auto leading-relaxed">
            Eliminate per-seat SaaS subscription taxes and regain full data privacy. Spin up your dedicated Orbit node in under 60 seconds.
          </p>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-4">
            <Link
              href="https://wondercraftz.com/contact"
              className="px-8 py-4 rounded-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 text-white font-bold text-sm hover:opacity-95 transition-all shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2"
            >
              <span>Launch Interactive Web App</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Trust points */}
          <div className="mt-8 pt-8 border-t border-white/10 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>PostgreSQL & Redis Core</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>HD Audio & Video Calling</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Slack Token Compatible</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

