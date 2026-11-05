'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Shield,
  Zap,
  Code2,
  Heart,
  Layers,
  ArrowRight,
  Server,
  Database,
  Cpu,
  Video,
  CheckCircle2,
  Users,
} from 'lucide-react';

import { Navbar } from '@/components/marketing/Navbar';
import { Footer } from '@/components/marketing/Footer';
import { ScrollProgressBar } from '@/components/marketing/ScrollProgressBar';
import { CtaBanner } from '@/components/marketing/CtaBanner';
import { ArchitectureDiagram } from '@/components/marketing/ArchitectureDiagram';

const VALUES = [
  {
    icon: Shield,
    title: 'Absolute Data Sovereignty & Privacy',
    description:
      'Your internal messages, intellectual property, and whiteboard canvases belong solely to you. We believe team tools should never monetize customer data, inject analytics pixels, or train opaque AI models on internal conversations.',
  },
  {
    icon: Zap,
    title: 'Ludicrous Speed & Unified Flow',
    description:
      'We obsess over latency and flow. From instant chat updates to zero-lag whiteboard drawing and real-time ticket sync, Orbit brings your team into one responsive environment.',
  },
  {
    icon: Code2,
    title: 'Complete Workspace Integration',
    description:
      'No more jumping between 5 different disconnected apps. Chat channels, creative canvases, Kanban tickets, documentation notes, and team availability live seamlessly together.',
  },
  {
    icon: Heart,
    title: 'Crafted for Modern Teams',
    description:
      'We build tools that we love using every day. Polished keyboard navigation, dark and light mode ergonomics, beautiful typography, and effortless workflows for designers, managers, and developers.',
  },
];

const ARCHITECTURE_STACK = [
  {
    name: 'Next.js 14 & Tailwind CSS',
    role: 'Frontend Client & Responsive PWA',
    detail: 'Modern React server components, fluid typography, and sub-100ms client route transitions.',
    icon: Layers,
  },
  {
    name: 'Fastify + Socket.IO',
    role: 'Ultra-High-Throughput Realtime Server',
    detail: 'Handles millions of concurrent websocket connections with minimal event-loop delay and memory footprint.',
    icon: Cpu,
  },
  {
    name: 'WebRTC Calling Engine',
    role: 'Audio, Video & Screen Share Media Engine',
    detail: 'Enterprise-grade media engine providing adaptive bitrate, active speaker detection, and 60fps video.',
    icon: Video,
  },
  {
    name: 'PostgreSQL 16 Database',
    role: 'Relational Persistence Layer',
    detail: 'Type-safe schema migrations, indexes on channel/thread foreign keys, and relational message consistency.',
    icon: Database,
  },
  {
    name: 'Redis 7 In-Memory Pub/Sub',
    role: 'Cross-Instance Message Broker',
    detail: 'Enables horizontal cluster scaling and instant presence state distribution across multiple nodes.',
    icon: Server,
  },
];

export function AboutView() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-zinc-100 overflow-x-hidden selection:bg-indigo-500 selection:text-white transition-colors duration-200">
      <ScrollProgressBar />
      <Navbar />

      {/* Hero / Mission */}
      <section className="pt-36 pb-20 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
        <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-indigo-600/20 via-purple-600/15 to-cyan-500/20 blur-[130px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-mono mb-6">
            <span>OUR MISSION & PHILOSOPHY</span>
          </div>

          <h1 className="font-display font-black text-4xl sm:text-6xl lg:text-7xl text-slate-900 dark:text-white tracking-tight leading-[1.05] mb-6">
            Rebuilding the modern team collaboration workspace
          </h1>

          <p className="text-base sm:text-xl text-slate-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-10">
            Orbit was founded on a simple conviction: modern teams deserve an all-in-one platform where messaging, whiteboarding, project tickets, documents, and availability work seamlessly together.
          </p>
        </div>
      </section>

      {/* Manifesto Section */}
      <section id="manifesto" className="py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 shadow-xl space-y-6 text-slate-700 dark:text-zinc-300 leading-relaxed text-base sm:text-lg">
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 dark:text-white mb-4">
            The Problem with Modern Team Tooling
          </h2>
          <p>
            Teams today are constantly context-switching between 5 or 6 disconnected software tools: one for chat, another for whiteboards, a separate tool for task tracking, another for documentation, and yet another for employee check-ins.
          </p>
          <p>
            This fragmentation creates silos, slows down decision-making, and piles on expensive per-seat software subscription fees.
          </p>
          <p className="text-indigo-600 dark:text-indigo-400 font-semibold">
            We built Orbit to bring everything together into a unified, high-speed workspace. Chat in channels, ideate on collaborative whiteboard canvases, organize project tickets, create rich documents, and view live team availability — all in one place.
          </p>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-mono mb-4">
            <span>CORE VALUES</span>
          </div>
          <h2 className="font-display font-black text-3xl sm:text-4xl text-slate-900 dark:text-white tracking-tight">
            The principles that guide every pull request
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {VALUES.map((val) => {
            const Icon = val.icon;
            return (
              <div
                key={val.title}
                className="p-8 rounded-3xl bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-white/10 hover:border-indigo-500/40 transition-colors shadow-lg"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 dark:bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-cyan-400 mb-6">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white mb-3">{val.title}</h3>
                <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">{val.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* System Architecture */}
      <section id="architecture" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-mono mb-4">
            <span>UNDER THE HOOD</span>
          </div>
          <h2 className="font-display font-black text-3xl sm:text-4xl text-slate-900 dark:text-white tracking-tight">
            Battle-tested architecture for real-time scale
          </h2>
          <p className="mt-4 text-base text-slate-600 dark:text-zinc-400">
            Engineered with modern, open primitives rather than proprietary lock-in.
          </p>
        </div>

        {/* Interactive Architecture Motion Graphic */}
        <ArchitectureDiagram />

        <div className="space-y-4 max-w-4xl mx-auto">
          {ARCHITECTURE_STACK.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.name}
                className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-cyan-500/40 transition-colors shadow"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-base text-slate-900 dark:text-white">{item.name}</h4>
                    <p className="text-xs text-indigo-600 dark:text-cyan-400 font-mono font-medium">{item.role}</p>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">{item.detail}</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-400 dark:text-zinc-500 shrink-0">Pillar 0{idx + 1}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Community Section */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center border-t border-slate-200 dark:border-white/5">
        <div className="max-w-2xl mx-auto">
          <Users className="w-12 h-12 text-indigo-500 dark:text-indigo-400 mx-auto mb-4" />
          <h2 className="font-display font-black text-3xl text-slate-900 dark:text-white mb-4">
            Built with a global community
          </h2>
          <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mb-8">
            Orbit is maintained by Wondercraftz engineers and contributors across 30+ countries. Whether writing code, reporting bugs, or drafting documentation, your contribution is welcomed.
          </p>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-900 dark:text-white font-medium text-sm transition-colors"
          >
            <span>Contribute on GitHub</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* Final CTA Banner */}
      <CtaBanner />

      {/* Footer */}
      <Footer />
    </div>
  );
}
