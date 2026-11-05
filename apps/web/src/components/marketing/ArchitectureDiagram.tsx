'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Layers,
  Cpu,
  Video,
  Database,
  Server,
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity,
} from 'lucide-react';

interface Node {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  metric: string;
  badge: string;
  color: string;
  accent: string;
}

const NODES: Node[] = [
  {
    id: 'client',
    title: 'Client Apps',
    subtitle: 'Next.js 14 & PWA',
    icon: Layers,
    metric: '< 100ms load',
    badge: 'Desktop & Web',
    color: 'from-indigo-500/20 to-blue-500/20',
    accent: 'text-indigo-400',
  },
  {
    id: 'gateway',
    title: 'Fastify Gateway',
    subtitle: 'Socket.IO Engine',
    icon: Cpu,
    metric: '11ms ping',
    badge: 'Real-time Server',
    color: 'from-cyan-500/20 to-teal-500/20',
    accent: 'text-cyan-400',
  },
  {
    id: 'redis',
    title: 'Redis 7 Broker',
    subtitle: 'In-Memory Pub/Sub',
    icon: Server,
    metric: 'Sub-2ms cache',
    badge: 'Horizontal Sync',
    color: 'from-purple-500/20 to-pink-500/20',
    accent: 'text-purple-400',
  },
  {
    id: 'storage',
    title: 'PostgreSQL 16',
    subtitle: 'Relational Store',
    icon: Database,
    metric: 'Full ACID',
    badge: 'Local Volume',
    color: 'from-emerald-500/20 to-teal-500/20',
    accent: 'text-emerald-400',
  },
  {
    id: 'webrtc',
    title: 'WebRTC Engine',
    subtitle: 'Voice & Video Media',
    icon: Video,
    metric: '60 FPS 4K',
    badge: 'Peer-to-Peer SFU',
    color: 'from-amber-500/20 to-orange-500/20',
    accent: 'text-amber-400',
  },
];

export function ArchitectureDiagram() {
  const [activeNode, setActiveNode] = useState<string>('gateway');

  return (
    <div className="w-full max-w-4xl mx-auto mb-16 p-6 sm:p-10 rounded-3xl bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-white/10 shadow-xl overflow-hidden relative">
      {/* Ambient background light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[250px] bg-gradient-to-r from-indigo-500/10 via-cyan-500/10 to-purple-500/10 blur-3xl pointer-events-none rounded-full" />

      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-white/5 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-mono text-xs uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
            Live System Topology & Flow Inspector
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-zinc-400">
          <Activity className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
          <span>Interactive: Hover any node to trace packets</span>
        </div>
      </div>

      {/* Interactive Topology Visualizer */}
      <div className="py-8 relative z-10">
        {/* Animated Connecting Flow Lines (SVG) */}
        <div className="hidden md:block absolute inset-0 pointer-events-none">
          <svg className="w-full h-full" fill="none">
            {/* Top row connectors */}
            <motion.path
              d="M 120 70 L 400 70"
              stroke="#6366F1"
              strokeWidth="2"
              strokeDasharray="4 4"
              animate={{ strokeDashoffset: [-20, 0] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
              opacity="0.4"
            />
            <motion.path
              d="M 400 70 L 680 70"
              stroke="#06B6D4"
              strokeWidth="2"
              strokeDasharray="4 4"
              animate={{ strokeDashoffset: [-20, 0] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
              opacity="0.4"
            />
            {/* Bottom connectors */}
            <motion.path
              d="M 400 70 L 260 210"
              stroke="#A855F7"
              strokeWidth="2"
              strokeDasharray="4 4"
              animate={{ strokeDashoffset: [-20, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              opacity="0.4"
            />
            <motion.path
              d="M 400 70 L 540 210"
              stroke="#10B981"
              strokeWidth="2"
              strokeDasharray="4 4"
              animate={{ strokeDashoffset: [-20, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              opacity="0.4"
            />
          </svg>
        </div>

        {/* Top 3 Nodes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 relative">
          {NODES.slice(0, 3).map((node) => {
            const Icon = node.icon;
            const isSelected = activeNode === node.id;
            return (
              <motion.div
                key={node.id}
                onMouseEnter={() => setActiveNode(node.id)}
                whileHover={{ y: -4, scale: 1.02 }}
                className={`p-5 rounded-2xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-slate-50 dark:bg-zinc-800/90 border-indigo-500 shadow-lg shadow-indigo-500/10'
                    : 'bg-white/60 dark:bg-zinc-950/60 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${node.color} flex items-center justify-center ${node.accent}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 font-medium">
                    {node.metric}
                  </span>
                </div>
                <h4 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  {node.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono mt-0.5">
                  {node.subtitle}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom 2 Nodes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto relative">
          {NODES.slice(3, 5).map((node) => {
            const Icon = node.icon;
            const isSelected = activeNode === node.id;
            return (
              <motion.div
                key={node.id}
                onMouseEnter={() => setActiveNode(node.id)}
                whileHover={{ y: -4, scale: 1.02 }}
                className={`p-5 rounded-2xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-slate-50 dark:bg-zinc-800/90 border-indigo-500 shadow-lg shadow-indigo-500/10'
                    : 'bg-white/60 dark:bg-zinc-950/60 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${node.color} flex items-center justify-center ${node.accent}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 font-medium">
                    {node.metric}
                  </span>
                </div>
                <h4 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  {node.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono mt-0.5">
                  {node.subtitle}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Bottom Live Metrics Banner */}
      <div className="pt-5 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-around gap-4 text-xs font-mono text-slate-600 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-cyan-500" />
          <span>WebSocket Event Loop: 0.1ms delay</span>
        </span>
        <span className="hidden sm:inline">•</span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>DTLS-SRTP Media Security</span>
        </span>
        <span className="hidden sm:inline">•</span>
        <span className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-indigo-500" />
          <span>Zero External Telemetry</span>
        </span>
      </div>
    </div>
  );
}

