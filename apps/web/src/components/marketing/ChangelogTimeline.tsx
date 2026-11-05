'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Zap,
  Wrench,
  CheckCircle2,
  Calendar,
  Tag,
  GitCommit,
  ArrowRight,
  ShieldCheck,
  Video,
} from 'lucide-react';

type Category = 'All' | 'New' | 'Improved' | 'Fixed';

interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  summary: string;
  category: 'New' | 'Improved' | 'Fixed';
  tags: string[];
  highlights: string[];
}

const ENTRIES: ChangelogEntry[] = [
  {
    version: 'v2.4.0',
    date: 'November 2, 2026',
    title: 'LiveKit SFU 2.6 Upgrade & 60 FPS 4K Screen Sharing',
    summary:
      'Major performance overhaul of the WebRTC SFU media subsystem with active speaker priority weighting, simulcast video streaming, and 50% lower CPU usage during 20+ participant huddles.',
    category: 'New',
    tags: ['WebRTC', 'LiveKit', 'Huddles', 'Media'],
    highlights: [
      'Adaptive bitrate switching down to 64kbps on poor connections',
      'System audio passthrough for Mac and Windows screen sharing',
      'Instant audio track reconnection when switching network interfaces',
    ],
  },
  {
    version: 'v2.3.2',
    date: 'October 24, 2026',
    title: 'Threaded Reply Caching & Cursor Pagination in Fastify',
    summary:
      'Upgraded message store to use cursor-based pagination with Redis key caching. Main channel scroll history loads instantaneously even with over 1,000,000 recorded messages.',
    category: 'Improved',
    tags: ['Redis', 'Fastify', 'Performance', 'Database'],
    highlights: [
      'Sub-5ms query times for 50-message chunks',
      'Optimistic message rendering with pending state animation',
      'Reduced memory footprint of Fastify server by 35%',
    ],
  },
  {
    version: 'v2.3.0',
    date: 'October 12, 2026',
    title: 'Slack-Compatible Bearer Token (xoxb-) Bot Engine',
    summary:
      'Seamlessly point your Slack bots, incoming webhooks, and slash commands directly at your Orbit instance without rewriting third-party integrations.',
    category: 'New',
    tags: ['Developer API', 'Bots', 'Webhooks'],
    highlights: [
      'Standard /api/bot/chat.postMessage endpoint support',
      'Custom slash command dispatcher with signature validation',
      'Scoped workspace bot tokens with revocation UI',
    ],
  },
  {
    version: 'v2.2.4',
    date: 'September 28, 2026',
    title: 'WebSocket Reconnection Handshake & Presence Sync Bug Fixes',
    summary:
      'Resolved race conditions during network roaming where user online status flickered when switching from Wi-Fi to mobile hotspot.',
    category: 'Fixed',
    tags: ['Socket.IO', 'Presence', 'Bug Fix'],
    highlights: [
      'Exponential backoff reconnection algorithm with jitter',
      'Guaranteed delivery of typing stop signals on unmount',
      'Fixed unread badge count sync across multiple open browser tabs',
    ],
  },
  {
    version: 'v2.2.0',
    date: 'September 15, 2026',
    title: 'Workspace Multi-Tenancy & Custom Vanity URL Routing',
    summary:
      'Organizations can now host multiple independent workspaces on a single Docker deployment with isolated user tables and custom invite links.',
    category: 'New',
    tags: ['Multi-Tenant', 'Architecture', 'Admin'],
    highlights: [
      'Subdomain and vanity slug routing support',
      'Role-based access control (Owner, Admin, Member, Guest)',
      'Invite code generator with expiration timestamps',
    ],
  },
];

export function ChangelogTimeline() {
  const [filter, setFilter] = useState<Category>('All');

  const filteredEntries = ENTRIES.filter((entry) => {
    if (filter === 'All') return true;
    return entry.category === filter;
  });

  const getBadgeStyle = (category: string) => {
    switch (category) {
      case 'New':
        return 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
      case 'Improved':
        return 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30';
      case 'Fixed':
        return 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30';
      default:
        return 'bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white border-slate-300 dark:border-white/20';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Category Filter Chips with FLIP layout animation */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-16">
        {(['All', 'New', 'Improved', 'Fixed'] as Category[]).map((cat) => {
          const isActive = filter === cat;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`relative px-4 py-2 rounded-full text-xs font-mono font-medium transition-colors ${
                isActive
                  ? 'text-white'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white bg-slate-200/60 dark:bg-white/5 border border-slate-300 dark:border-white/10'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeFilterPill"
                  className="absolute inset-0 bg-indigo-600 rounded-full shadow-lg shadow-indigo-600/30"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{cat} Updates</span>
            </button>
          );
        })}
      </div>

      {/* Vertical Timeline */}
      <div className="relative pl-6 sm:pl-10 border-l border-slate-300 dark:border-white/10 space-y-16">
        <AnimatePresence mode="popLayout">
          {filteredEntries.map((entry, idx) => (
            <motion.div
              key={entry.version}
              layout
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4, delay: idx * 0.05 }}
              className="relative group"
            >
              {/* Timeline Marker Dot */}
              <div className="absolute -left-[31px] sm:-left-[47px] top-1.5 w-4 h-4 rounded-full bg-slate-50 dark:bg-zinc-950 border-2 border-indigo-500 group-hover:scale-125 transition-transform flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400" />
              </div>

              {/* Card Container */}
              <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 shadow-xl hover:border-indigo-500/40 transition-colors">
                {/* Meta Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="font-display font-black text-xl text-slate-900 dark:text-white">
                      {entry.version}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getBadgeStyle(
                        entry.category
                      )}`}
                    >
                      {entry.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-zinc-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{entry.date}</span>
                  </div>
                </div>

                <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white mb-3">
                  {entry.title}
                </h3>

                <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed mb-6">
                  {entry.summary}
                </p>

                {/* Highlights List */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200 dark:border-white/5 mb-5 space-y-2">
                  <p className="text-xs uppercase font-mono font-bold tracking-wider text-slate-500 dark:text-zinc-400 mb-2">
                    Key Enhancements:
                  </p>
                  {entry.highlights.map((h, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-zinc-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 mt-0.5 shrink-0" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {entry.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

