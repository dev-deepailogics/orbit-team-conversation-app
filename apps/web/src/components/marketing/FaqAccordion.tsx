'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    category: 'Self-Hosting',
    question: 'Can I self-host Orbit on any VPS or bare-metal server?',
    answer:
      'Yes, 100%. Orbit is distributed with a complete Docker Compose file that spins up Fastify, PostgreSQL 16, Redis 7, and the WebRTC media calling engine in a single network. A standard 2 vCPU / 4GB RAM VPS on Hetzner, DigitalOcean, or AWS handles hundreds of concurrent team members with ease.',
  },
  {
    category: 'Migration',
    question: 'How compatible is Orbit with existing Slack bots and webhooks?',
    answer:
      'Orbit provides a Slack-compatible Bearer token engine (xoxb- tokens) and implements the standard /chat.postMessage endpoints. Your GitHub actions, Sentry alerts, CI/CD pipelines, and custom scripts can point directly to Orbit without changing their payload structures.',
  },
  {
    category: 'Audio & Video',
    question: 'How does Orbit achieve ultra-low latency audio/video calling?',
    answer:
      'Rather than using unscalable mesh peer-to-peer connections or expensive third-party proprietary clouds, Orbit bundles a self-hosted WebRTC calling engine. This provides adaptive bitrate distribution, active speaker detection, and sub-50ms peer latency even across multi-party screen shares.',
  },
  {
    category: 'Security & Privacy',
    question: 'Does Orbit send any telemetry or conversation logs back to your servers?',
    answer:
      'Zero. Unlike commercial cloud chat applications that log telemetry, parse message contents for ad profiles, or train proprietary LLMs, Orbit does not include any analytics trackers, third-party beacons, or telemetry backdoors. Your messages live exclusively on your PostgreSQL database.',
  },
  {
    category: 'Sovereignty',
    question: 'Is the self-hosted version truly free forever?',
    answer:
      'Yes. The community edition includes unlimited users, unlimited channels, full message history retention, and unlimited audio/video calling. Our software gives complete data ownership.',
  },
  {
    category: 'Clients',
    question: 'Are there desktop and mobile applications available?',
    answer:
      'Yes! Orbit is designed with responsive Progressive Web App (PWA) architecture and also supports dedicated wrappers for macOS, Linux, and Windows, alongside an iOS and Android React Native mobile codebase.',
  },
];

export function FaqAccordion({ items = FAQ_ITEMS }: { items?: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div
            key={idx}
            className={`rounded-2xl border transition-colors overflow-hidden ${
              isOpen
                ? 'bg-white dark:bg-zinc-900/90 border-indigo-500/40 shadow-lg'
                : 'bg-slate-50/80 dark:bg-zinc-950/40 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          >
            <button
              onClick={() => toggle(idx)}
              aria-expanded={isOpen}
              className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 focus:outline-none"
            >
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                <span className="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                  {item.question}
                </span>
              </div>
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="shrink-0 text-slate-500 dark:text-zinc-400"
              >
                <ChevronDown className="w-5 h-5" />
              </motion.div>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="px-5 sm:px-6 pb-6 pt-1 text-sm text-slate-600 dark:text-zinc-400 leading-relaxed border-t border-slate-100 dark:border-white/5">
                    <p>{item.answer}</p>
                    <div className="mt-3">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-white/10 uppercase tracking-wider font-semibold">
                        Topic: {item.category}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

