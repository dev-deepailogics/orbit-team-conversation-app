'use client';

import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { PenTool, FolderKanban, Users, ArrowRight, CheckCircle2 } from 'lucide-react';

const STEPS = [
  {
    step: '01',
    title: 'Create Projects & Workspaces',
    tag: 'Quick Setup',
    icon: FolderKanban,
    description:
      'Set up your organization workspace in seconds. Group initiatives into dedicated projects with custom color accents, notification channels, and team permissions.',
    codeSnippet: 'Project created: Design Sprint • 12 active members',
    highlights: ['Multi-project portfolio overview', 'Custom workspace vanity URLs', 'One-click member invite links'],
  },
  {
    step: '02',
    title: 'Ideate on Whiteboard Canvas & Docs',
    tag: 'Creative Collaboration',
    icon: PenTool,
    description:
      'Brainstorm architectures on infinite whiteboard canvases with shapes, sticky notes, and live cursors. Document specs with rich Notion-style slash commands.',
    codeSnippet: 'Canvas session active: Wireframes & System Architecture',
    highlights: ['Interactive drawing tools & sticky notes', 'Notion-style block documents', 'Public & private guest share links'],
  },
  {
    step: '03',
    title: 'Track Tickets & Team Availability',
    tag: 'Streamlined Delivery',
    icon: Users,
    description:
      'Convert ideas and chat messages straight into Kanban tickets. Track live status, break reasons, working hours, and voice calling standups all in one place.',
    codeSnippet: 'Ticket #42 moved to Done • Alexandre R. checked in',
    highlights: ['Kanban boards with drag-and-drop', 'Real-time employee check-in & breaks', 'One-click voice and video calling'],
  },
];

export function HowItWorksSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: '-100px' });

  return (
    <section ref={containerRef} className="py-24 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[350px] bg-indigo-600/10 blur-[120px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-mono mb-4">
            <span>HOW IT WORKS</span>
          </div>
          <h2 className="font-display font-black text-3xl sm:text-5xl text-slate-900 dark:text-white tracking-tight">
            From initial idea to executed project in minutes
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-zinc-400">
            A frictionless workflow designed for agile teams: create projects, sketch ideas on canvases, write documents, track tickets, and sync in real time.
          </p>
        </div>

        {/* Steps Grid with SVG Connector */}
        <div className="relative">
          {/* Animated Connecting SVG Path for Desktop */}
          <div className="hidden lg:block absolute top-28 left-[15%] right-[15%] h-2 pointer-events-none -z-0">
            <svg className="w-full h-8 overflow-visible" fill="none">
              <motion.path
                d="M 0 4 L 800 4"
                stroke="url(#stepGradient)"
                strokeWidth="2"
                strokeDasharray="6 6"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={isInView ? { pathLength: 1, opacity: 0.8 } : { pathLength: 0, opacity: 0 }}
                transition={{ duration: 1.5, ease: 'easeInOut' }}
              />
              {/* Traveling light particle */}
              {isInView && (
                <motion.circle
                  r="4"
                  fill="#06B6D4"
                  filter="drop-shadow(0 0 6px #06B6D4)"
                  animate={{
                    cx: [0, 800],
                    cy: [4, 4],
                    opacity: [0, 1, 1, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                />
              )}
              <defs>
                <linearGradient id="stepGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366F1" />
                  <stop offset="50%" stopColor="#06B6D4" />
                  <stop offset="100%" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {STEPS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 30 }}
                  animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                  transition={{
                    duration: 0.6,
                    delay: idx * 0.2,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="relative p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 hover:border-indigo-500/40 transition-all shadow-sm dark:shadow-xl group flex flex-col justify-between"
                >
                  {/* Step number badge */}
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-gradient-to-tr dark:from-indigo-600/30 dark:to-cyan-500/30 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-cyan-300 group-hover:scale-110 transition-transform">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="font-display font-black text-3xl sm:text-4xl text-slate-300 dark:text-zinc-700/60">
                        {item.step}
                      </span>
                    </div>

                    <div className="inline-block text-[11px] font-mono text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-2">
                      {item.tag}
                    </div>

                    <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white mb-3">
                      {item.title}
                    </h3>

                    <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mb-6">
                      {item.description}
                    </p>
                  </div>

                  <div>
                    {/* Code Snippet Box */}
                    <div className="p-3 rounded-xl bg-slate-900 dark:bg-zinc-950/90 border border-slate-800 dark:border-white/5 font-mono text-xs text-indigo-300 overflow-x-auto mb-4">
                      <code>{item.codeSnippet}</code>
                    </div>

                    {/* Highlights list */}
                    <ul className="space-y-2 border-t border-slate-100 dark:border-white/5 pt-4 text-xs text-slate-600 dark:text-zinc-400">
                      {item.highlights.map((h, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

