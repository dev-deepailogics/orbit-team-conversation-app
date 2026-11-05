'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Quote, Star, ShieldCheck } from 'lucide-react';

const TESTIMONIALS = [
  {
    quote:
      'We replaced our $18k/month Slack enterprise contract with self-hosted Orbit on a $60 VPS. Latency dropped from 250ms to 12ms, audio and video calls never drop, and our security compliance audit was a breeze.',
    author: 'Marcus Vance',
    badge: 'Self-Hosted Cluster',
    stars: 5,
  },
  {
    quote:
      'The Slack-compatible bot token system made our migration instantaneous. Our GitHub CI/CD webhooks, Jira automations, and custom deploy bots worked on day one with zero code changes.',
    author: 'Dr. Sarah Lin',
    badge: '5,000+ Engineers',
    stars: 5,
  },
  {
    quote:
      'Audio and video calling clarity is unreal. It feels like everyone is in the same room. The UI is lightning fast, keyboard shortcuts match muscle memory, and there is zero clutter.',
    author: 'Alexandre Dubois',
    badge: 'Remote-First',
    stars: 5,
  },
  {
    quote:
      'For defense and healthcare clients requiring strict air-gapped data sovereignty, Orbit is the only team messaging platform that offers modern design without sending telemetry back to Silicon Valley.',
    author: 'Evelyn Reed',
    badge: 'Air-Gapped GovCloud',
    stars: 5,
  },
];

export function TestimonialCarousel() {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const handlePrev = () => {
    setCurrent((prev) => (prev === 0 ? TESTIMONIALS.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrent((prev) => (prev + 1) % TESTIMONIALS.length);
  };

  const t = TESTIMONIALS[current];

  return (
    <section className="py-24 relative overflow-hidden bg-slate-100/70 dark:bg-zinc-950/60 border-y border-slate-200 dark:border-white/5 transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-mono mb-4">
            <span>PROVEN AT SCALE</span>
          </div>
          <h2 className="font-display font-black text-3xl sm:text-4xl text-slate-900 dark:text-white tracking-tight">
            Trusted by architects, security teams, and engineering leaders
          </h2>
        </div>

        {/* Carousel Container */}
        <div
          className="relative"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className="min-h-[280px] sm:min-h-[240px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="w-full p-8 sm:p-12 rounded-3xl bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-2xl relative"
              >
                <div className="flex items-center justify-between mb-6">
                  {/* Star Rating */}
                  <div className="flex items-center gap-1">
                    {[...Array(t.stars)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>

                  <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
                    <span>{t.badge}</span>
                  </span>
                </div>

                <p className="text-base sm:text-xl font-medium text-slate-800 dark:text-zinc-200 leading-relaxed italic mb-8">
                  "{t.quote}"
                </p>

                <div className="flex items-center justify-between border-t border-slate-100 dark:border-white/10 pt-6">
                  <div>
                    <h4 className="font-display font-bold text-base text-slate-900 dark:text-white">
                      {t.author}
                    </h4>
                  </div>

                  <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400 dark:text-zinc-500">
                    <span>{current + 1}</span>
                    <span>/</span>
                    <span>{TESTIMONIALS.length}</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between mt-8">
            {/* Dots */}
            <div className="flex items-center gap-2">
              {TESTIMONIALS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrent(idx)}
                  aria-label={`Jump to slide ${idx + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    idx === current
                      ? 'w-8 bg-indigo-600'
                      : 'w-2 bg-slate-300 dark:bg-zinc-700 hover:bg-slate-400 dark:hover:bg-zinc-500'
                  }`}
                />
              ))}
            </div>

            {/* Arrows */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                aria-label="Previous testimonial"
                className="w-10 h-10 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/30 shadow-sm transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNext}
                aria-label="Next testimonial"
                className="w-10 h-10 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/30 shadow-sm transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

