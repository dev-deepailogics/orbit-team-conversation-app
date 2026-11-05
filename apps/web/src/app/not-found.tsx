'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Compass, Home, Layers, ArrowLeft, Radio } from 'lucide-react';
import { Navbar } from '@/components/marketing/Navbar';
import { Footer } from '@/components/marketing/Footer';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-zinc-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white transition-colors duration-200">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-32 text-center relative overflow-hidden">
        {/* Ambient cosmic aura */}
        <div className="absolute w-[600px] h-[350px] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none -z-10" />

        {/* Playful Floating Deep-Space Satellite Illustration */}
        <motion.div
          animate={{
            y: [-12, 12, -12],
            rotate: [-4, 4, -4],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="relative w-44 h-44 mb-8"
        >
          {/* Orbital Ring */}
          <div className="absolute inset-0 rounded-full border border-dashed border-indigo-500/40 animate-spin" style={{ animationDuration: '30s' }} />

          {/* Central Satellite Body */}
          <div className="absolute inset-6 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[2px] shadow-2xl shadow-indigo-600/40">
            <div className="w-full h-full bg-white dark:bg-zinc-950 rounded-[14px] flex flex-col items-center justify-center p-3 shadow">
              <Radio className="w-8 h-8 text-indigo-600 dark:text-cyan-300 animate-pulse" />
              <span className="font-mono text-[10px] text-slate-500 dark:text-zinc-400 mt-2 font-bold">BEACON: 404</span>
            </div>
          </div>

          {/* Satellite Solar Panels */}
          <div className="absolute top-1/2 -left-6 -translate-y-1/2 w-7 h-10 rounded bg-cyan-100 dark:bg-cyan-950 border border-cyan-400 dark:border-cyan-500/40 flex flex-col justify-around p-1">
            <div className="w-full h-[1px] bg-cyan-500/40" />
            <div className="w-full h-[1px] bg-cyan-500/40" />
          </div>
          <div className="absolute top-1/2 -right-6 -translate-y-1/2 w-7 h-10 rounded bg-cyan-100 dark:bg-cyan-950 border border-cyan-400 dark:border-cyan-500/40 flex flex-col justify-around p-1">
            <div className="w-full h-[1px] bg-cyan-500/40" />
            <div className="w-full h-[1px] bg-cyan-500/40" />
          </div>
        </motion.div>

        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-mono mb-4">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span>SIGNAL LOST IN ORBIT</span>
        </div>

        <h1 className="font-display font-black text-4xl sm:text-6xl text-slate-900 dark:text-white tracking-tight mb-4">
          404: Out of Range
        </h1>

        <p className="text-slate-600 dark:text-zinc-400 max-w-md mx-auto text-sm sm:text-base leading-relaxed mb-8">
          The requested coordinate or channel does not exist in this workspace cluster. Our deep-space probes could not locate any active socket listener.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/"
            className="px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/30"
          >
            <Home className="w-4 h-4" />
            <span>Return to Mission Control</span>
          </Link>

          <Link
            href="/app"
            className="px-6 py-3 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-900 dark:text-white font-medium text-sm border border-slate-300 dark:border-white/10 transition-colors flex items-center gap-2"
          >
            <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>Launch Web App</span>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}

