'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Hash,
  Video,
  PenTool,
  Trello,
  FileText,
  Clock,
  FolderKanban,
  Shield,
  Layers,
  ArrowRight,
  CheckCircle2,
  Terminal,
  Cpu,
  Zap,
  Sparkles,
  Lock,
  Search,
  Sliders,
  Smile,
  Mic,
  Volume2,
  Plus,
  StickyNote,
  Square,
  Circle,
  Share2,
} from 'lucide-react';

import { Navbar } from '@/components/marketing/Navbar';
import { Footer } from '@/components/marketing/Footer';
import { ScrollProgressBar } from '@/components/marketing/ScrollProgressBar';
import { ScrollytellingFeatures } from '@/components/marketing/ScrollytellingFeatures';
import { ComparisonTable } from '@/components/marketing/ComparisonTable';
import { CtaBanner } from '@/components/marketing/CtaBanner';

export function FeaturesView() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-zinc-100 overflow-x-hidden selection:bg-indigo-500 selection:text-white transition-colors duration-200">
      <ScrollProgressBar />
      <Navbar />

      {/* Hero Overview */}
      <section className="pt-36 pb-20 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
        <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[750px] h-[400px] bg-gradient-to-tr from-indigo-500/15 via-cyan-500/15 to-purple-500/10 dark:from-indigo-600/20 dark:via-cyan-500/20 dark:to-purple-500/10 blur-[130px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-mono mb-6">
            <Sparkles className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
            <span>DEEP DIVE INTO ORBIT CAPABILITIES</span>
          </div>

          <h1 className="font-display font-black text-4xl sm:text-6xl lg:text-7xl text-slate-900 dark:text-white tracking-tight leading-[1.05] mb-6">
            Everything your team needs. Beautifully unified in one place.
          </h1>

          <p className="text-base sm:text-xl text-slate-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-10">
            Explore Orbit's full workspace suite: interactive whiteboard canvas, project ticket tracking, rich collaborative documents, team availability check-ins, and focused channels with voice calling.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="#scrollytelling"
              className="px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/30"
            >
              <span>Explore Architecture Tour</span>
              <ArrowRight className="w-4 h-4" />
            </a>
           
          </div>
        </div>
      </section>

      {/* Grouped Alternating Deep Dives */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-28">
        {/* Feature 1: Channels & Threads (Visual Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-mono">
              <Hash className="w-3.5 h-3.5" />
              <span>COMMUNICATION INFRASTRUCTURE</span>
            </div>

            <h2 className="font-display font-black text-3xl sm:text-4xl text-slate-900 dark:text-white tracking-tight">
              Channels, direct messages, and focused threaded discussions
            </h2>

            <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-400 leading-relaxed">
              Main channels shouldn't become chaotic firehoses. Orbit introduces threaded discussions that keep side conversations nested and organized without cluttering your team’s main feed.
            </p>

            <ul className="space-y-3 text-sm text-slate-700 dark:text-zinc-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-1 shrink-0" />
                <span><strong>Instant Typing Indicators:</strong> Low-bandwidth socket event emission so you always know when teammates are responding.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-1 shrink-0" />
                <span><strong>Cursor Pagination:</strong> Instant message scrollback without UI freezes or memory leaks, even with 1M+ chat records.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-1 shrink-0" />
                <span><strong>Full Markdown & Syntax Highlighting:</strong> Send code blocks in TypeScript, Rust, Python, Go, and SQL with clean syntax themes.</span>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="p-6 rounded-3xl bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5 text-xs text-slate-600 dark:text-zinc-400">
                <span className="font-mono text-indigo-600 dark:text-cyan-400 font-bold">#architecture-rfcs</span>
                <span className="font-mono text-slate-400 dark:text-zinc-500">12 online</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200 dark:border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">Sarah Lin</span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono">11:14 AM</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-zinc-300">
                  RFC #29: We are migrating the thread cache from in-process memory to Redis 7 cluster.
                </p>
                <div className="p-2.5 rounded-lg bg-slate-900 text-indigo-300 font-mono text-[11px]">
                  {`const socket = getSocket();\nsocket.emit('thread:reply', { threadId, content });`}
                </div>
              </div>

              {/* Animated Live Typing Indicator */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100/80 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/5 text-xs text-slate-500 dark:text-zinc-400">
                <span className="text-[11px] font-mono">Alexandre R. is typing</span>
                <div className="flex items-center gap-1 ml-1">
                  <motion.span
                    animate={{ y: [0, -3, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                    className="w-1.5 h-1.5 rounded-full bg-indigo-500"
                  />
                  <motion.span
                    animate={{ y: [0, -3, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                    className="w-1.5 h-1.5 rounded-full bg-indigo-500"
                  />
                  <motion.span
                    animate={{ y: [0, -3, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                    className="w-1.5 h-1.5 rounded-full bg-indigo-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/20 text-xs text-indigo-700 dark:text-indigo-300 flex items-center justify-between font-mono">
                <span>Thread Replies: 8 messages</span>
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Live Sync (11ms)
                </span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Feature 2: Audio & Video Calling (Visual Left) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 order-2 lg:order-1">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="p-6 rounded-3xl bg-white dark:bg-zinc-900/80 border border-cyan-500/30 shadow-lg dark:shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-600 dark:text-cyan-400">
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  <span>Audio & Video Engine Active</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-mono">
                  Opus 48kHz
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-indigo-200 dark:border-indigo-500/30 relative overflow-hidden">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white mb-2 shadow-sm relative z-10">
                      AR
                    </div>
                    {/* Speaker soundwave ping rings */}
                    <motion.div
                      animate={{ scale: [1, 1.4, 1.8], opacity: [0.6, 0.3, 0] }}
                      transition={{ repeat: Infinity, duration: 1.8, ease: "easeOut" }}
                      className="absolute -top-1 -left-1 w-12 h-12 rounded-xl border border-indigo-500/60 pointer-events-none"
                    />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Alexandre R.</p>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono">Talking (Active Speaker)</p>
                  
                  {/* Realtime animated equalizer bars */}
                  <div className="mt-2.5 flex items-end gap-1 h-6">
                    {[16, 24, 12, 22, 18, 26, 14, 20].map((h, i) => (
                      <motion.span
                        key={i}
                        animate={{ height: [`${Math.max(4, h * 0.25)}px`, `${h}px`, `${Math.max(4, h * 0.4)}px`] }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.5 + (i % 4) * 0.15,
                          repeatType: "reverse",
                          ease: "easeInOut",
                          delay: i * 0.06,
                        }}
                        className="w-1 bg-gradient-to-t from-indigo-500 to-cyan-400 rounded-full"
                      />
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 relative">
                  <div className="w-10 h-10 rounded-xl bg-cyan-600 flex items-center justify-center font-bold text-white mb-2 shadow-sm">
                    SK
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Sofia K.</p>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono">Screen Share (60 FPS)</p>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                      4K Ultra-HD 60fps
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-100 dark:bg-zinc-950/90 border border-slate-200 dark:border-white/5 text-[11px] font-mono text-slate-600 dark:text-zinc-400 flex items-center justify-between">
                <span>Packet Loss: 0.00%</span>
                <span className="text-indigo-600 dark:text-indigo-400">Latency: 14ms</span>
              </div>
            </motion.div>
          </div>

          <div className="lg:col-span-6 order-1 lg:order-2 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-mono">
              <Video className="w-3.5 h-3.5" />
              <span>EMBEDDED WEBRTC ENGINE</span>
            </div>

            <h2 className="font-display font-black text-3xl sm:text-4xl text-slate-900 dark:text-white tracking-tight">
              Zero-lag audio and video calling with native screen sharing
            </h2>

            <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-400 leading-relaxed">
              No need to switch to Zoom or Google Meet for ad-hoc standups. Orbit includes high-performance WebRTC media calling that delivers broadcast-grade audio, multi-party video grids, and crisp desktop screen sharing directly inside your channels.
            </p>

            <ul className="space-y-3 text-sm text-slate-700 dark:text-zinc-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-1 shrink-0" />
                <span><strong>Selective Forwarding Architecture:</strong> Client bandwidth is preserved because participants stream efficiently rather than peer-to-peer meshes.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-1 shrink-0" />
                <span><strong>Simulcast Video Encoding:</strong> Automatically adapts resolution based on individual participant network quality.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-1 shrink-0" />
                <span><strong>Zero Additional Fees:</strong> Unlimited calling minutes on your own VPS.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Feature 3: Interactive Canvas Whiteboard (Visual Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-mono">
              <PenTool className="w-3.5 h-3.5" />
              <span>CREATIVE COLLABORATION</span>
            </div>

            <h2 className="font-display font-black text-3xl sm:text-4xl text-slate-900 dark:text-white tracking-tight">
              Interactive Canvas & Infinite Whiteboard
            </h2>

            <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-400 leading-relaxed">
              Ditch external whiteboard tools. Orbit features an infinite collaborative canvas where your team can sketch diagrams, wireframe user interfaces, place color-coded sticky notes, draw geometric shapes, and brainstorm with live multiplayer cursors.
            </p>

            <ul className="space-y-3 text-sm text-slate-700 dark:text-zinc-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-1 shrink-0" />
                <span><strong>Rich Creative Toolkit:</strong> Freehand pencil, shapes, connectors, text blocks, and sticky notes with customizable colors.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-1 shrink-0" />
                <span><strong>Real-Time Cursor Tracking:</strong> See teammates move and edit live across the canvas without lag.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-1 shrink-0" />
                <span><strong>Export & Share:</strong> Download whiteboards as high-res images or embed them directly into channel discussions.</span>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="p-6 rounded-3xl bg-white dark:bg-zinc-900/80 border border-purple-500/30 shadow-lg dark:shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-purple-600 dark:text-purple-400">Whiteboard Canvas</span>
                  <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-300 font-mono text-[10px]">
                    Live Multiplayer
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 dark:text-zinc-500 text-[11px] font-mono">
                  <span>3 editors active</span>
                </div>
              </div>

              {/* Whiteboard simulation canvas container */}
              <div className="h-56 rounded-2xl bg-slate-900 p-4 relative overflow-hidden border border-slate-800">
                {/* Background dot grid pattern */}
                <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

                {/* Simulated Sticky Notes */}
                <motion.div
                  animate={{ y: [0, -3, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  className="absolute top-4 left-6 w-32 p-3 rounded-lg bg-amber-400 text-slate-900 shadow-md text-xs font-medium rotate-[-2deg]"
                >
                  <p className="font-bold mb-1">💡 Architecture</p>
                  <p className="text-[10px] leading-tight">Unify chat & ticket workflow</p>
                </motion.div>

                <motion.div
                  animate={{ y: [0, 4, 0] }}
                  transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
                  className="absolute top-10 right-10 w-36 p-3 rounded-lg bg-emerald-400 text-slate-900 shadow-md text-xs font-medium rotate-[3deg]"
                >
                  <p className="font-bold mb-1">🚀 Launch Plan</p>
                  <p className="text-[10px] leading-tight">Project Board + Docs integration</p>
                </motion.div>

                {/* Animated Simulated Cursor */}
                <motion.div
                  animate={{
                    x: [40, 140, 90, 40],
                    y: [120, 80, 150, 120],
                  }}
                  transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                  className="absolute flex items-center gap-1.5 pointer-events-none z-20"
                >
                  <svg className="w-4 h-4 text-cyan-400 fill-current drop-shadow" viewBox="0 0 24 24">
                    <path d="M4 0l16 12-7 2-4 8z" />
                  </svg>
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950 font-bold text-[9px]">
                    Sarah Lin
                  </span>
                </motion.div>

                {/* Connector line preview */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <motion.path
                    d="M 120 70 C 180 90, 180 60, 240 80"
                    fill="none"
                    stroke="#818CF8"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    animate={{ strokeDashoffset: [0, -16] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  />
                </svg>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-mono">
                <span>Tools: Pen, Sticky, Rectangle, Arrow, Text</span>
                <span className="text-emerald-600 dark:text-emerald-400">Synced Real-Time</span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Feature 4: Project Boards & Agile Tickets (Visual Left) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 order-2 lg:order-1">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="p-6 rounded-3xl bg-white dark:bg-zinc-900/80 border border-amber-500/30 shadow-lg dark:shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2 text-xs font-mono text-amber-600 dark:text-amber-400 font-bold">
                  <Trello className="w-4 h-4" />
                  <span>Sprint Board • Sprint #14</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-300 font-mono">
                  8 Tickets Active
                </span>
              </div>

              {/* Kanban Column Previews */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                {/* Column 1: Backlog / To Do */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-zinc-400">
                    <span>TO DO</span>
                    <span className="text-[10px] bg-slate-200 dark:bg-zinc-800 px-1 rounded">2</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 shadow-sm text-[11px] space-y-1">
                    <p className="font-semibold text-slate-800 dark:text-white">API Rate Limiter</p>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 font-mono">High</span>
                  </div>
                </div>

                {/* Column 2: In Progress */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-indigo-200 dark:border-indigo-500/30 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                    <span>IN PROGRESS</span>
                    <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">3</span>
                  </div>
                  <motion.div
                    animate={{ y: [0, -2, 0] }}
                    transition={{ repeat: Infinity, duration: 3 }}
                    className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-indigo-500/30 shadow-sm text-[11px] space-y-1"
                  >
                    <p className="font-semibold text-slate-800 dark:text-white">Whiteboard Sync</p>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-600 dark:text-rose-300 font-mono">Urgent</span>
                  </motion.div>
                </div>

                {/* Column 3: Done */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-emerald-200 dark:border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <span>DONE</span>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 px-1 rounded">5</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 shadow-sm text-[11px] space-y-1 opacity-75">
                    <p className="font-semibold text-slate-800 dark:text-white line-through">Audio Calling</p>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-mono">Done</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between font-mono">
                <span>Create tickets directly from chat messages</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">1-Click Convert</span>
              </div>
            </motion.div>
          </div>

          <div className="lg:col-span-6 order-1 lg:order-2 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-mono">
              <Trello className="w-3.5 h-3.5" />
              <span>PROJECT BOARDS & TICKETS</span>
            </div>

            <h2 className="font-display font-black text-3xl sm:text-4xl text-slate-900 dark:text-white tracking-tight">
              Turn conversations into organized, actionable tickets
            </h2>

            <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-400 leading-relaxed">
              Never let important customer feedback, bug reports, or product ideas get lost in endless chat scrollback. Convert any message into an agile ticket with assignees, priorities, due dates, and custom Kanban stages.
            </p>

            <ul className="space-y-3 text-sm text-slate-700 dark:text-zinc-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-1 shrink-0" />
                <span><strong>Convert Chat to Ticket:</strong> Hover any message and click "Create Ticket" with automatically populated context.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-1 shrink-0" />
                <span><strong>Custom Workflow Columns:</strong> Tailor project boards to match your team’s delivery rhythm (To Do, In Review, QA, Deployed).</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-1 shrink-0" />
                <span><strong>Multi-Project Portfolio:</strong> Switch effortlessly between frontend, backend, marketing, and design project boards.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Feature 5: Collaborative Documents & Employee Availability (Visual Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-mono">
              <FileText className="w-3.5 h-3.5" />
              <span>DOCS & TEAM AVAILABILITY</span>
            </div>

            <h2 className="font-display font-black text-3xl sm:text-4xl text-slate-900 dark:text-white tracking-tight">
              Rich documents & real-time team availability tracking
            </h2>

            <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-400 leading-relaxed">
              Draft PRDs, sprint notes, and knowledge-base articles with Notion-grade block editing and shareable guest links. Meanwhile, stay informed of teammates’ work statuses, break states, and daily check-ins without intrusive micromanagement.
            </p>

            <ul className="space-y-3 text-sm text-slate-700 dark:text-zinc-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-1 shrink-0" />
                <span><strong>Notion-Style Rich Editor:</strong> Headers, bullet lists, code snippets, quote callouts, and checklists.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-1 shrink-0" />
                <span><strong>Shareable Public Links:</strong> Share project documents securely with external clients or stakeholders.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-1 shrink-0" />
                <span><strong>Availability Check-In:</strong> Log break reasons (Lunch, Meeting, Tea Break) and track working hours smoothly.</span>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="p-6 rounded-3xl bg-white dark:bg-zinc-900/80 border border-emerald-500/30 shadow-lg dark:shadow-2xl space-y-4"
            >
              {/* Document Preview Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200 dark:border-white/5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                    <FileText className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Project Spec: Q3 Release Roadmap</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
                    Public Link
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-300">
                  Comprehensive release plan covering canvas whiteboards, Kanban sprint boards, and availability tracking.
                </p>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                  <span>✓ 14 tasks complete</span>
                  <span>• 3 collaborators</span>
                </div>
              </div>

              {/* Availability Tracker Preview Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-indigo-200 dark:border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="font-bold text-slate-900 dark:text-white">Team Availability</span>
                  </div>
                  <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-mono flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Online & Active
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5">
                    <p className="font-semibold text-slate-900 dark:text-white">Alexandre R.</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">Active (6h 24m)</p>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5">
                    <p className="font-semibold text-slate-900 dark:text-white">Sarah Lin</p>
                    <p className="text-[10px] text-amber-500 font-mono">Lunch Break (18m)</p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between font-mono">
                <span>Unified under one workspace organization</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">Zero Context Switch</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* STICKY SCROLLYTELLING BLOCK */}
      <div id="scrollytelling">
        <ScrollytellingFeatures />
      </div>

      {/* COMPARISON / EVERYTHING INCLUDED TABLE */}
      <ComparisonTable />

      {/* FINAL CTA BANNER */}
      <CtaBanner />

      {/* FOOTER */}
      <Footer />
    </div>
  );
}
