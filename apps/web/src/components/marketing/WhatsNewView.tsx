'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Rss, Github, ArrowRight, Layers } from 'lucide-react';

import { Navbar } from '@/components/marketing/Navbar';
import { Footer } from '@/components/marketing/Footer';
import { ScrollProgressBar } from '@/components/marketing/ScrollProgressBar';
import { ChangelogTimeline } from '@/components/marketing/ChangelogTimeline';
import { CtaBanner } from '@/components/marketing/CtaBanner';

export function WhatsNewView() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-zinc-100 overflow-x-hidden selection:bg-indigo-500 selection:text-white transition-colors duration-200">
      <ScrollProgressBar />
      <Navbar />

      {/* Hero Header */}
      <section className="pt-36 pb-16 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-indigo-600/20 via-purple-600/15 to-cyan-500/20 blur-[130px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-mono mb-6">
            <Sparkles className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
            <span>CONTINUOUS OPEN-SOURCE RELEASES</span>
          </div>

          <h1 className="font-display font-black text-4xl sm:text-6xl lg:text-7xl text-slate-900 dark:text-white tracking-tight leading-[1.05] mb-6">
            What's new in Orbit
          </h1>

          <p className="text-base sm:text-xl text-slate-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-8">
            Read our engineering releases, architecture upgrades, performance benchmarks, and security advisories as we build the next-generation team OS.
          </p>

          <div className="flex items-center justify-center gap-4 text-xs font-mono text-slate-600 dark:text-zinc-400">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/70 dark:bg-white/5 border border-slate-300 dark:border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Current Stable: v2.4.0</span>
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/70 dark:bg-white/5 border border-slate-300 dark:border-white/10">
              <Github className="w-3.5 h-3.5" />
              <span>Bi-weekly Release Cadence</span>
            </span>
          </div>
        </div>
      </section>

      {/* Interactive Changelog Timeline Section */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ChangelogTimeline />
      </section>

      {/* Final CTA Banner */}
      <CtaBanner />

      {/* Footer */}
      <Footer />
    </div>
  );
}
