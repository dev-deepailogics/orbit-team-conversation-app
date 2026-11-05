'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hash,
  Video,
  PenTool,
  Trello,
  FileText,
  Clock,
  FolderKanban,
  CheckCircle2,
  Cpu,
  Layers,
  Sparkles,
  Shield,
  Volume2,
} from 'lucide-react';

const STEPS = [
  {
    id: 'canvas',
    icon: PenTool,
    title: 'Interactive Canvas Whiteboard',
    eyebrow: 'REAL-TIME CREATIVITY',
    description:
      'Brainstorm freely on an infinite canvas with pens, shapes, sticky notes, connectors, and real-time live multiplayer cursor collaboration.',
    specs: [
      'Infinite zoomable and pannable whiteboard canvas',
      'Freehand pen, rectangles, circles, arrows, and text',
      'Color-coded sticky notes with markdown formatting',
    ],
    mockType: 'canvas',
  },
  {
    id: 'tickets',
    icon: Trello,
    title: 'Agile Ticket & Issue Tracking',
    eyebrow: 'TASK MANAGEMENT',
    description:
      'Turn conversations directly into actionable tasks. Customizable Kanban columns, priorities, member assignments, and timeline views.',
    specs: [
      '1-click ticket generation directly from chat messages',
      'Drag-and-drop Kanban workflow columns',
      'Priority flags (Low, Medium, High, Urgent) and assignees',
    ],
    mockType: 'tickets',
  },
  {
    id: 'docs',
    icon: FileText,
    title: 'Collaborative Rich Documents',
    eyebrow: 'KNOWLEDGE BASE',
    description:
      'Write Notion-style product specs, RFCs, and meeting notes with slash commands, code blocks, checklists, and shareable guest links.',
    specs: [
      'Slash command block editor (h1-h3, quote, code, todo)',
      'Instant document sharing via public guest URLs',
      'Linked directly to project milestones and tickets',
    ],
    mockType: 'docs',
  },
  {
    id: 'availability',
    icon: Clock,
    title: 'Team Availability & Break Tracking',
    eyebrow: 'WORKPLACE SYNC',
    description:
      'Know at a glance who is available, on lunch, in meetings, or taking a break with automated status tracking and working hour summaries.',
    specs: [
      'Quick break logging (Lunch, Namaz, Tea Break, Meeting)',
      'Live elapsed time tracker and active session indicators',
      'Zero invasive tracking — respectful transparency',
    ],
    mockType: 'availability',
  },
  {
    id: 'calling',
    icon: Video,
    title: 'Channels, Threads & Voice Calling',
    eyebrow: 'COMMUNICATION HUB',
    description:
      'Stay connected through organized topic channels, nested thread replies, instant voice calls, and crisp desktop screen sharing.',
    specs: [
      'Sub-15ms message socket delivery & typing indicators',
      'Native WebRTC voice calling and screen share',
      'Markdown support and custom emoji reactions',
    ],
    mockType: 'calling',
  },
];

export function ScrollytellingFeatures() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section className="py-24 relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Eyebrow */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-mono mb-4">
          <span>SCROLLYTELLING ARCHITECTURE</span>
        </div>
        <h2 className="font-display font-black text-3xl sm:text-5xl text-slate-900 dark:text-white tracking-tight">
          Engineered from the ground up for high-velocity teams
        </h2>
        <p className="mt-4 text-base text-slate-600 dark:text-zinc-400">
          Click or scroll through the core pillars that make Orbit radically faster and more secure than legacy team messengers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Left Column: Interactive Steps List */}
        <div className="lg:col-span-5 space-y-4">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeStep === idx;
            return (
              <div
                key={step.id}
                onClick={() => setActiveStep(idx)}
                className={`p-6 sm:p-7 rounded-2xl cursor-pointer transition-all border ${
                  isActive
                    ? 'bg-white dark:bg-zinc-900/90 border-indigo-500 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500/20'
                    : 'bg-white/60 dark:bg-zinc-950/40 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-cyan-600 dark:text-cyan-400">
                      {step.eyebrow}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400 dark:text-zinc-500">0{idx + 1}</span>
                </div>

                <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white mb-2">
                  {step.title}
                </h3>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mb-4">
                  {step.description}
                </p>

                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="border-t border-slate-100 dark:border-white/10 pt-3 space-y-1.5"
                  >
                    {step.specs.map((spec, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-700 dark:text-zinc-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                        <span>{spec}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Column: Sticky Dynamic Preview Canvas */}
        <div className="lg:col-span-7 lg:sticky lg:top-28">
          <div className="relative rounded-3xl p-1 bg-gradient-to-br from-indigo-500/20 via-cyan-500/20 to-transparent shadow-2xl">
            <div className="bg-[#0C101A] rounded-[22px] border border-white/10 p-6 sm:p-8 min-h-[460px] flex flex-col justify-between overflow-hidden relative">
              {/* Top ambient aura */}
              <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-mono text-zinc-300">
                    Interactive Feature Inspector: {STEPS[activeStep].id.toUpperCase()}
                  </span>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Live preview
                </span>
              </div>

              {/* Dynamic Content Morph */}
              <div className="my-auto py-6 relative z-10">
                <AnimatePresence mode="wait">
                  {activeStep === 0 && (
                    <motion.div
                      key="mock-canvas"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      <div className="h-48 rounded-xl bg-slate-900 border border-white/10 p-4 relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:14px_14px] opacity-40" />
                        <div className="absolute top-3 left-4 p-2.5 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs shadow-md rotate-[-2deg]">
                          💡 Whiteboard Ideation
                        </div>
                        <div className="absolute top-12 right-6 p-2.5 rounded-lg bg-cyan-400 text-slate-950 font-bold text-xs shadow-md rotate-[2deg]">
                          🚀 Sprint #14 User Flows
                        </div>
                        <svg className="absolute inset-0 w-full h-full pointer-events-none">
                          <path
                            d="M 100 60 C 150 90, 180 50, 230 70"
                            fill="none"
                            stroke="#A78BFA"
                            strokeWidth="2"
                            strokeDasharray="4 4"
                          />
                        </svg>
                      </div>
                      <div className="p-3 rounded-lg bg-purple-950/40 border border-purple-500/30 text-xs text-purple-300 flex items-center justify-between font-mono">
                        <span>Multiplayer Canvas Active</span>
                        <span className="text-emerald-400">Live 60fps Cursors</span>
                      </div>
                    </motion.div>
                  )}

                  {activeStep === 1 && (
                    <motion.div
                      key="mock-tickets"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-3"
                    >
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="p-3 rounded-xl bg-zinc-900 border border-white/10 space-y-2">
                          <p className="font-mono text-zinc-400 text-[10px] font-bold">TO DO</p>
                          <div className="p-2 rounded bg-zinc-800 text-[11px] text-white">OAuth Sync</div>
                        </div>
                        <div className="p-3 rounded-xl bg-zinc-900 border border-indigo-500/30 space-y-2">
                          <p className="font-mono text-indigo-400 text-[10px] font-bold">IN PROGRESS</p>
                          <div className="p-2 rounded bg-indigo-950/60 border border-indigo-500/40 text-[11px] text-white">
                            Canvas Tooling
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-zinc-900 border border-emerald-500/30 space-y-2">
                          <p className="font-mono text-emerald-400 text-[10px] font-bold">DONE</p>
                          <div className="p-2 rounded bg-zinc-800 text-[11px] text-zinc-400 line-through">
                            Rich Editor
                          </div>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-zinc-900 border border-white/10 text-xs text-zinc-300 flex items-center justify-between font-mono">
                        <span>Converted from Chat Message</span>
                        <span className="text-cyan-400">Assigned: Alexandre R.</span>
                      </div>
                    </motion.div>
                  )}

                  {activeStep === 2 && (
                    <motion.div
                      key="mock-docs"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-3"
                    >
                      <div className="p-4 rounded-xl bg-zinc-900 border border-white/10 space-y-2">
                        <div className="flex items-center justify-between text-xs pb-1 border-b border-white/5">
                          <span className="font-bold text-white">RFC #42: Workspace Architecture</span>
                          <span className="text-emerald-400 font-mono text-[10px]">Published</span>
                        </div>
                        <p className="text-xs text-zinc-300">
                          Unified documentation with slash command blocks, embeddable code snippets, and public guest view links.
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between font-mono">
                        <span>Guest Link Sharing: Enabled</span>
                        <span>Read Time: 4 mins</span>
                      </div>
                    </motion.div>
                  )}

                  {activeStep === 3 && (
                    <motion.div
                      key="mock-availability"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-3"
                    >
                      <div className="p-4 rounded-xl bg-zinc-900 border border-white/10 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white">Daily Check-In & Status</span>
                          <span className="text-emerald-400 text-[10px] font-mono">Online</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-lg bg-zinc-800 text-white">
                            <p className="font-medium">Active Session</p>
                            <p className="text-emerald-400 font-mono text-[10px]">5h 42m elapsed</p>
                          </div>
                          <div className="p-2.5 rounded-lg bg-zinc-800 text-white">
                            <p className="font-medium">Break State</p>
                            <p className="text-amber-400 font-mono text-[10px]">Lunch (30m)</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-300 flex items-center justify-between font-mono">
                        <span>Status: Respectful Transparency</span>
                        <span className="text-emerald-400">No Invasive Telemetry</span>
                      </div>
                    </motion.div>
                  )}

                  {activeStep === 4 && (
                    <motion.div
                      key="mock-calling"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 rounded-xl bg-zinc-900 border border-cyan-500/50 relative overflow-hidden">
                          <div className="w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-sm mb-2">
                            JD
                          </div>
                          <p className="text-xs font-bold text-white">Julian Drake</p>
                          <p className="text-[10px] text-zinc-500 font-mono">Speaking now</p>
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 relative">
                          <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-sm mb-2">
                            AS
                          </div>
                          <p className="text-xs font-bold text-white">Affan Siddiqui</p>
                          <p className="text-[10px] text-zinc-500 font-mono">Screen Share (60fps)</p>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-300 font-mono flex items-center justify-between">
                        <span>WebRTC Calling Active</span>
                        <span className="text-emerald-400">Sub-15ms Latency</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bottom bar inside canvas */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-zinc-400 relative z-10 font-mono">
                <span>Step {activeStep + 1} of {STEPS.length}</span>
                <span className="text-indigo-400">{STEPS[activeStep].title}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

