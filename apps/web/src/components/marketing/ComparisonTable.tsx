'use client';

import React from 'react';
import { Check, X, Sparkles, Shield, Zap } from 'lucide-react';

const COMPARISON_DATA = [
  {
    feature: 'Interactive Canvas Whiteboard',
    category: 'Creativity',
    orbit: 'Built-in (Infinite Canvas)',
    slack: 'No (Needs Miro/Mural)',
    teams: 'Basic Whiteboard addon',
  },
  {
    feature: 'Agile Ticket & Project Boards',
    category: 'Project Management',
    orbit: 'Built-in (Kanban & Timeline)',
    slack: 'No (Needs Jira/Linear)',
    teams: 'No (Needs MS Planner)',
  },
  {
    feature: 'Collaborative Rich Documents',
    category: 'Knowledge Base',
    orbit: 'Built-in (Notion-style blocks)',
    slack: 'Basic canvases only',
    teams: 'Separate OneNote/Loop app',
  },
  {
    feature: 'Team Availability & Break Tracking',
    category: 'Workplace Sync',
    orbit: 'Built-in (Daily Status)',
    slack: 'Simple emoji status only',
    teams: 'Outlook calendar sync only',
  },
  {
    feature: 'Channels, Threads & Voice Calling',
    category: 'Communication',
    orbit: 'Included (Zero lag)',
    slack: 'Included (Paywalled calling)',
    teams: 'Included',
  },
  {
    feature: 'Data Sovereignty & Privacy',
    category: 'Security',
    orbit: '100% Sovereign (No tracking)',
    slack: 'Centralized proprietary cloud',
    teams: 'Centralized proprietary cloud',
  },
  {
    feature: 'All-in-One Unified Workspace',
    category: 'Tooling',
    orbit: 'Yes (1 app for everything)',
    slack: 'Requires 4+ extra paid tools',
    teams: 'Requires complex 365 bundle',
  },
];

export function ComparisonTable() {
  return (
    <section className="py-24 relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-mono mb-4">
          <span>OBJECTIVE BENCHMARK</span>
        </div>
        <h2 className="font-display font-black text-3xl sm:text-5xl text-slate-900 dark:text-white tracking-tight">
          How Orbit compares to legacy enterprise tools
        </h2>
        <p className="mt-4 text-base text-slate-600 dark:text-zinc-400">
          Everything included by default. No hidden per-seat paywalls, artificial message history locks, or sluggish client apps.
        </p>
      </div>

      {/* Responsive Table Wrapper */}
      <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950/80 shadow-xl dark:shadow-2xl">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-900/60">
              <th className="py-5 px-6 font-display font-bold text-sm text-slate-600 dark:text-zinc-400 uppercase tracking-wider w-2/5">
                Feature / Capability
              </th>
              {/* Highlighted Orbit Column */}
              <th className="py-5 px-6 bg-indigo-50/80 dark:bg-indigo-600/10 border-x border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 font-display font-black text-base w-1/5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                  <span>Orbit (Self-Hosted)</span>
                </div>
              </th>
              <th className="py-5 px-6 font-display font-semibold text-sm text-slate-600 dark:text-zinc-400 w-1/5">
                Slack
              </th>
              <th className="py-5 px-6 font-display font-semibold text-sm text-slate-600 dark:text-zinc-400 w-1/5">
                Microsoft Teams
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
            {COMPARISON_DATA.map((row, idx) => (
              <tr
                key={row.feature}
                className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                {/* Feature Name */}
                <td className="py-4 px-6 font-medium text-slate-900 dark:text-white">
                  <div className="flex flex-col">
                    <span>{row.feature}</span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                      {row.category}
                    </span>
                  </div>
                </td>

                {/* Orbit column */}
                <td className="py-4 px-6 bg-indigo-50/50 dark:bg-indigo-600/10 border-x border-indigo-200 dark:border-indigo-500/30 font-bold text-indigo-700 dark:text-cyan-300">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                    <span>{row.orbit}</span>
                  </div>
                </td>

                {/* Slack column */}
                <td className="py-4 px-6 text-slate-600 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    {row.slack.startsWith('No') ? (
                      <X className="w-4 h-4 text-rose-500 shrink-0" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-zinc-600 shrink-0" />
                    )}
                    <span>{row.slack}</span>
                  </div>
                </td>

                {/* Teams column */}
                <td className="py-4 px-6 text-slate-600 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    {row.teams.startsWith('No') ? (
                      <X className="w-4 h-4 text-rose-500 shrink-0" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-zinc-600 shrink-0" />
                    )}
                    <span>{row.teams}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

