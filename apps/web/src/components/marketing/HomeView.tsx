'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight,
  Shield,
  MessageSquare,
  Video,
  PenTool,
  Trello,
  FileText,
  Clock,
  FolderKanban,
  CheckCircle2,
} from 'lucide-react';

import { Navbar } from '@/components/marketing/Navbar';
import { Footer } from '@/components/marketing/Footer';
import { ScrollProgressBar } from '@/components/marketing/ScrollProgressBar';
import { StatCounter } from '@/components/marketing/StatCounter';
import { ProductMockup } from '@/components/marketing/ProductMockup';
import { HowItWorksSection } from '@/components/marketing/HowItWorksSection';
import { TestimonialCarousel } from '@/components/marketing/TestimonialCarousel';
import { CtaBanner } from '@/components/marketing/CtaBanner';

const HERO_WORDS = ['The', 'All-in-One', 'Team', 'Collaboration', 'Workspace'];

const FEATURES = [
  {
    icon: PenTool,
    title: 'Interactive Canvas Whiteboard',
    description:
      'Brainstorm freely on an infinite canvas with pens, shapes, sticky notes, connectors, and real-time live multiplayer cursor collaboration.',
    badge: 'Live Whiteboard',
    gradient: 'from-purple-500/20 to-indigo-500/10',
  },
  {
    icon: Trello,
    title: 'Agile Ticket & Issue Tracking',
    description:
      'Turn conversations directly into actionable tasks. Customizable Kanban columns, priorities, member assignments, and timeline views.',
    badge: 'Project Boards',
    gradient: 'from-amber-500/20 to-orange-500/10',
  },
  {
    icon: FolderKanban,
    title: 'Multi-Project Management',
    description:
      'Create and organize distinct team projects. Track overall portfolio progress, milestones, and deliverables in one unified hub.',
    badge: 'Projects',
    gradient: 'from-blue-500/20 to-cyan-500/10',
  },
  {
    icon: FileText,
    title: 'Collaborative Rich Documents',
    description:
      'Write Notion-style product specs, RFCs, and meeting notes with slash commands, code blocks, checklists, and shareable guest links.',
    badge: 'Rich Docs',
    gradient: 'from-emerald-500/20 to-teal-500/10',
  },
  {
    icon: Clock,
    title: 'Real-Time Availability & Check-in',
    description:
      'Know at a glance who is available, on lunch, in meetings, or taking a break with automated status tracking and working hour summaries.',
    badge: 'Availability',
    gradient: 'from-rose-500/20 to-pink-500/10',
  },
  {
    icon: MessageSquare,
    title: 'Channels, Threads & Voice Calling',
    description:
      'Stay connected through organized topic channels, nested thread replies, instant voice calls, and crisp screen sharing.',
    badge: 'Chat & Calling',
    gradient: 'from-indigo-500/20 to-blue-500/10',
  },
];

export function HomeView() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  // Oversized kinetic typography scroll effect
  const kineticScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const kineticOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.2]);
  const kineticY = useTransform(scrollYProgress, [0, 1], [0, 80]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-zinc-100 overflow-x-hidden selection:bg-indigo-500 selection:text-white transition-colors duration-200">
      <ScrollProgressBar />
      <Navbar />

      {/* HERO SECTION */}
      <section
        ref={heroRef}
        className="relative pt-32 sm:pt-40 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden"
      >
        {/* Animated Aurora Mesh Background */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-gradient-to-tr from-indigo-500/15 via-purple-500/10 to-cyan-400/15 dark:from-indigo-600/20 dark:via-purple-600/15 dark:to-cyan-500/20 blur-[130px] rounded-full pointer-events-none -z-10 animate-aurora" />

        {/* Floating Abstract Decorative Orbs */}
        <motion.div
          animate={{ y: [0, -16, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-24 left-[10%] w-28 h-28 rounded-full bg-gradient-to-br from-indigo-500/10 to-cyan-400/10 border border-slate-300/40 dark:border-white/10 blur-[1px] pointer-events-none hidden md:block"
        />
        <motion.div
          animate={{ y: [0, 20, 0], rotate: [0, -6, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-48 right-[12%] w-36 h-36 rounded-full bg-gradient-to-tr from-purple-500/10 to-indigo-500/10 border border-slate-300/40 dark:border-white/10 blur-[1px] pointer-events-none hidden md:block"
        />

        <div className="max-w-7xl mx-auto text-center relative z-10">
          {/* Staggered Split Headline Reveal */}
          <div className="overflow-hidden flex flex-wrap justify-center gap-x-3.5 gap-y-1 max-w-5xl mx-auto mb-6">
            {HERO_WORDS.map((word, idx) => (
              <motion.span
                key={idx}
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  duration: 0.7,
                  delay: idx * 0.07,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={`font-display font-black text-4xl sm:text-6xl lg:text-7xl xl:text-8xl tracking-tight leading-[1.05] ${
                  word === 'Collaboration' || word === 'Workspace'
                    ? 'text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 dark:from-indigo-400 dark:via-purple-300 dark:to-cyan-400'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {word}
              </motion.span>
            ))}
          </div>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="text-base sm:text-xl text-slate-600 dark:text-zinc-400 max-w-3xl mx-auto leading-relaxed mb-10"
          >
            A unified workspace designed for modern team productivity. Chat in channels, brainstorm on collaborative whiteboard canvases, organize agile tickets, author rich documents, and manage team availability — all in one place.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center justify-center gap-4 mb-16"
          >
            <Link
              href="https://wondercraftz.com/contact"
              className="px-8 py-4 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:opacity-95 text-white font-bold text-sm transition-all shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-2 group"
            >
              <span>Book a Demo</span>
              <ArrowRight className="w-4 h-4 text-cyan-200 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>

          {/* Oversized Kinetic Typography on Scroll */}
          <motion.div
            style={{
              scale: kineticScale,
              opacity: kineticOpacity,
              y: kineticY,
            }}
            className="pointer-events-none select-none text-[80px] sm:text-[140px] lg:text-[180px] font-display font-black text-slate-950/[0.04] dark:text-white/[0.03] tracking-tighter uppercase -mb-16 sm:-mb-24 leading-none"
          >
            WORKSPACE
          </motion.div>

          {/* Interactive 3D Product Mockup */}
          <ProductMockup />
        </div>
      </section>

      {/* FEATURE HIGHLIGHTS */}
      <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-mono mb-4">
            <span>UNCOMPROMISING SPEED & CONTROL</span>
          </div>
          <h2 className="font-display font-black text-3xl sm:text-5xl text-slate-900 dark:text-white tracking-tight">
            Everything your team needs to ship at peak velocity
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-zinc-400">
            Engineered to replace bloated SaaS applications with a lean, sovereign stack you fully own.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {FEATURES.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ duration: 0.3 }}
                className="relative p-6 sm:p-8 rounded-3xl bg-white dark:bg-zinc-900/60 border border-slate-200/90 dark:border-white/10 hover:border-indigo-500/50 transition-all group flex flex-col justify-between shadow-sm hover:shadow-xl dark:shadow-xl relative overflow-hidden"
              >
                {/* Motion Hover Gradient Glow */}
                <div className="absolute -inset-px bg-gradient-to-br from-indigo-500/10 via-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-3xl" />

                <div>
                  <div className="flex items-center justify-between mb-6">
                    <motion.div
                      whileHover={{ rotate: [0, -10, 10, 0] }}
                      transition={{ duration: 0.4 }}
                      className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-cyan-400 group-hover:scale-110 transition-transform shadow-sm"
                    >
                      <Icon className="w-6 h-6" />
                    </motion.div>
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300">
                      {feature.badge}
                    </span>
                  </div>

                  <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white mb-3">
                    {feature.title}
                  </h3>

                  <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <HowItWorksSection />

      {/* STATS COUNTER */}
      <StatCounter />

      {/* TESTIMONIALS */}
      <TestimonialCarousel />

      {/* FINAL CTA BANNER */}
      <CtaBanner />

      {/* FOOTER */}
      <Footer />
    </div>
  );
}
