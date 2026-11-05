'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';

interface StatProps {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  label: string;
  sublabel: string;
}

export function StatCounterItem({
  value,
  suffix = '',
  prefix = '',
  decimals = 0,
  label,
  sublabel,
}: StatProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    let start = 0;
    const duration = 2000; // ms
    const stepTime = 20; // 50 updates/sec
    const totalSteps = duration / stepTime;
    const increment = value / totalSteps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(start);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [isInView, value]);

  const formatted = decimals > 0 ? displayValue.toFixed(decimals) : Math.floor(displayValue).toLocaleString();

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative p-6 rounded-2xl bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-lg hover:border-indigo-500/40 transition-all text-center group"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10">
        <div className="font-display font-black text-4xl sm:text-5xl text-slate-900 dark:text-white tracking-tight flex items-baseline justify-center">
          {prefix && <span className="text-indigo-600 dark:text-indigo-400 text-3xl mr-0.5">{prefix}</span>}
          <span>{formatted}</span>
          {suffix && <span className="text-cyan-600 dark:text-cyan-400 text-3xl ml-0.5">{suffix}</span>}
        </div>
        <div className="font-display font-bold text-base text-slate-800 dark:text-zinc-200 mt-2">
          {label}
        </div>
        <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
          {sublabel}
        </div>
      </div>
    </motion.div>
  );
}

export function StatCounter() {
  return (
    <section className="py-20 relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCounterItem
          value={12}
          prefix="< "
          suffix="ms"
          label="P99 Socket Latency"
          sublabel="Real-time message propagation across distributed clusters"
        />
        <StatCounterItem
          value={99.99}
          decimals={2}
          suffix="%"
          label="Uptime SLA Target"
          sublabel="Decoupled LiveKit SFU + Fastify core architecture"
        />
        <StatCounterItem
          value={100}
          suffix="%"
          label="Self-Hosted Sovereignty"
          sublabel="Zero vendor telemetry, your database, your VPS"
        />
        <StatCounterItem
          value={150}
          suffix="k+"
          label="Messages / Second"
          sublabel="Benchmarked on single standard 4-core instance"
        />
      </div>
    </section>
  );
}

