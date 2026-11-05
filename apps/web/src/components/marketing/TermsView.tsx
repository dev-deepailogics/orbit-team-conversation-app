'use client';

import React from 'react';
import { FileText, Shield, Scale } from 'lucide-react';

import { Navbar } from '@/components/marketing/Navbar';
import { Footer } from '@/components/marketing/Footer';
import { ScrollProgressBar } from '@/components/marketing/ScrollProgressBar';

export function TermsView() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-zinc-100 overflow-x-hidden selection:bg-indigo-500 selection:text-white transition-colors duration-200">
      <ScrollProgressBar />
      <Navbar />

      <section className="pt-36 pb-16 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-mono mb-6">
            <Scale className="w-3.5 h-3.5" />
            <span>TERMS OF SERVICE • REVISED NOV 2026</span>
          </div>

          <h1 className="font-display font-black text-4xl sm:text-6xl text-slate-900 dark:text-white tracking-tight leading-[1.05] mb-4">
            Terms of Service
          </h1>

          <p className="text-base text-slate-600 dark:text-zinc-400 max-w-xl mx-auto">
            Please read these terms carefully before accessing or using Orbit self-hosted software or managed cloud services.
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 text-slate-700 dark:text-zinc-300 text-sm sm:text-base leading-relaxed space-y-10">
        <div className="space-y-4">
          <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
            1. Acceptance of Terms
          </h2>
          <p>
            By downloading, deploying, accessing, or using Orbit (including the self-hosted codebase, Docker images, and cloud-hosted tiers), you agree to be bound by these Terms of Service. If you are entering into this agreement on behalf of a company or organization, you represent that you have authority to bind that entity.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
            2. Platform Licensing & Usage
          </h2>
          <p>
            The core Orbit repository is licensed under community licensing guidelines. You are free to inspect, modify, and self-host the software in accordance with the terms of that license.
          </p>
          <p>
            You agree not to remove, alter, or obscure any copyright notices, trademarks, or proprietary markings present in the source distributions.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
            3. Acceptable Use Policy
          </h2>
          <p>
            You agree not to use Orbit (either self-hosted or cloud-hosted) to:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-zinc-400">
            <li>Engage in unlawful harassment, distribution of malicious payloads, or phishing attacks.</li>
            <li>Attempt to reverse-engineer or disrupt our managed cloud servers or other tenants.</li>
            <li>Circumvent licensing keys or usage tiers on Orbit Cloud Pro clusters.</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
            4. Managed Subscriptions & Service Level Agreements
          </h2>
          <p>
            For customers on paid plans (Orbit Cloud Pro and Enterprise), fees are billed in advance on a monthly or annual cadence. We commit to a 99.99% uptime availability for core message delivery and WebRTC SFU routing. In the event of an unscheduled outage exceeding our SLA, service credits will be issued according to your Enterprise agreement.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
            5. Disclaimer of Warranties & Limitation of Liability
          </h2>
          <p>
            To the maximum extent permitted by applicable law, the self-hosted edition is provided "AS IS", without warranty of any kind. Orbit Inc. shall not be liable for any indirect, incidental, punitive, or consequential damages resulting from data loss or server misconfigurations on self-hosted instances.
          </p>
        </div>

        <div className="p-8 rounded-3xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 shadow-lg space-y-3">
          <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
            6. Inquiries & Legal Notices
          </h2>
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            Legal notices or inquiries regarding commercial agreements should be addressed to:
          </p>
          <p className="font-mono text-cyan-600 dark:text-cyan-400 text-sm font-semibold">
            legal@orbit.wondercraftz.dev
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
