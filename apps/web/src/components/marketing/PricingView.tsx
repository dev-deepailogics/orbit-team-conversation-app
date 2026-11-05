'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Check,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  HelpCircle,
} from 'lucide-react';

import { Navbar } from '@/components/marketing/Navbar';
import { Footer } from '@/components/marketing/Footer';
import { ScrollProgressBar } from '@/components/marketing/ScrollProgressBar';
import { FaqAccordion } from '@/components/marketing/FaqAccordion';
import { CtaBanner } from '@/components/marketing/CtaBanner';

export function PricingView() {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-zinc-100 overflow-x-hidden selection:bg-indigo-500 selection:text-white transition-colors duration-200">
      <ScrollProgressBar />
      <Navbar />

      {/* Hero Header */}
      <section className="pt-36 pb-16 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
        <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-indigo-600/20 via-cyan-500/20 to-purple-500/15 blur-[130px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-mono mb-6">
            <Sparkles className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
            <span>TRANSPARENT & FAIR PRICING</span>
          </div>

          <h1 className="font-display font-black text-4xl sm:text-6xl lg:text-7xl text-slate-900 dark:text-white tracking-tight leading-[1.05] mb-6">
            Simple plans. Predictable infrastructure costs.
          </h1>

          <p className="text-base sm:text-xl text-slate-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-10">
            Never pay predatory $15/user/month seat taxes again. Self-host for free with complete ownership, or choose managed cloud convenience.
          </p>

          {/* Billing Toggle (Monthly / Annual) */}
          <div className="inline-flex items-center gap-3 p-1.5 rounded-full bg-slate-200/80 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-xs font-medium">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 rounded-full transition-colors ${
                !annual ? 'bg-indigo-600 text-white font-bold shadow' : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-2 rounded-full flex items-center gap-1.5 transition-colors ${
                annual ? 'bg-indigo-600 text-white font-bold shadow' : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              <span>Annual Billing</span>
              <span className="text-[10px] bg-cyan-400 text-black px-1.5 py-0.2 rounded-full font-bold">
                Save 20%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* 3 Pricing Cards */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {/* 1. Community */}
          <div className="p-8 sm:p-10 rounded-3xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 flex flex-col justify-between shadow-xl">
            <div>
              <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-2 font-semibold">
                Self-Hosted Freedom
              </div>
              <h2 className="font-display font-bold text-2xl text-slate-900 dark:text-white mb-2">Community</h2>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mb-6">
                Deploy on your own VPS with Docker Compose. Full data sovereignty.
              </p>

              <div className="font-display font-black text-5xl text-slate-900 dark:text-white mb-6">
                $0
                <span className="text-xs font-normal text-slate-500 dark:text-zinc-500 font-mono ml-2">free forever</span>
              </div>

              <div className="w-full h-[1px] bg-slate-200 dark:bg-white/10 mb-6" />

              <ul className="space-y-3.5 text-xs text-slate-700 dark:text-zinc-300 mb-8">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>Unlimited users & channels</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>Unlimited message history retention</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>LiveKit SFU audio/video huddles</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>Slack bot token (xoxb-) API</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>PostgreSQL & Redis architecture</span>
                </li>
              </ul>
            </div>

            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="w-full py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-center text-xs font-mono font-bold text-slate-900 dark:text-white transition-colors"
            >
              Get Docker Compose Specs
            </a>
          </div>

          {/* 2. Pro Cloud */}
          <div className="p-8 sm:p-10 rounded-3xl bg-white dark:bg-zinc-900 border-2 border-indigo-500 shadow-2xl relative flex flex-col justify-between">
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-[11px] font-mono font-black tracking-wider uppercase shadow-md">
              Recommended for Teams
            </span>

            <div>
              <div className="text-xs font-mono text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2 font-semibold">
                Managed Platform
              </div>
              <h2 className="font-display font-bold text-2xl text-slate-900 dark:text-white mb-2">Orbit Cloud Pro</h2>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mb-6">
                Zero devops headache. High-speed global edge clusters managed by our team.
              </p>

              <div className="font-display font-black text-5xl text-slate-900 dark:text-white mb-6">
                {annual ? '$4' : '$5'}
                <span className="text-xs font-normal text-slate-500 dark:text-zinc-400 font-mono ml-2">/ user / month</span>
              </div>

              <div className="w-full h-[1px] bg-slate-200 dark:bg-white/10 mb-6" />

              <ul className="space-y-3.5 text-xs text-slate-700 dark:text-zinc-200 mb-8">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span><strong>Everything in Community</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>Automated daily offsite backups</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>99.99% uptime service level agreement</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>Single Sign-On (Google Workspace & GitHub)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>Priority Discord & email support</span>
                </li>
              </ul>
            </div>

            <Link
              href="/app"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:opacity-95 text-center text-xs font-mono font-bold text-white transition-opacity shadow-lg shadow-indigo-600/30"
            >
              Start 14-Day Free Trial
            </Link>
          </div>

          {/* 3. Enterprise */}
          <div className="p-8 sm:p-10 rounded-3xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 flex flex-col justify-between shadow-xl">
            <div>
              <div className="text-xs font-mono text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2 font-semibold">
                Custom & Air-Gapped
              </div>
              <h2 className="font-display font-bold text-2xl text-slate-900 dark:text-white mb-2">Enterprise</h2>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mb-6">
                For organizations with strict compliance, SOC2, HIPAA, or air-gapped isolation needs.
              </p>

              <div className="font-display font-black text-5xl text-slate-900 dark:text-white mb-6">
                Custom
                <span className="text-xs font-normal text-slate-500 dark:text-zinc-500 font-mono ml-2">annual agreement</span>
              </div>

              <div className="w-full h-[1px] bg-slate-200 dark:bg-white/10 mb-6" />

              <ul className="space-y-3.5 text-xs text-slate-700 dark:text-zinc-300 mb-8">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span><strong>Everything in Cloud Pro</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>SAML 2.0 / Okta / Azure AD integration</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>Dedicated Solution Architect & onboarding</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>Air-gapped deployment assistance</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>24/7 dedicated Slack / phone emergency SLA</span>
                </li>
              </ul>
            </div>

            <Link
              href="/contact"
              className="w-full py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-center text-xs font-mono font-bold text-slate-900 dark:text-white transition-colors"
            >
              Contact Enterprise Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing FAQ */}
      <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-mono mb-4">
            <span>BILLING & DEPLOYMENT FAQS</span>
          </div>
          <h2 className="font-display font-black text-3xl sm:text-4xl text-slate-900 dark:text-white tracking-tight">
            Frequently asked questions about Orbit pricing
          </h2>
        </div>

        <FaqAccordion />
      </section>

      {/* Final CTA Banner */}
      <CtaBanner />

      {/* Footer */}
      <Footer />
    </div>
  );
}
