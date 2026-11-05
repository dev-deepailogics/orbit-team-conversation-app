'use client';

import React from 'react';
import { Shield, Lock, Eye, Server, FileText } from 'lucide-react';

import { Navbar } from '@/components/marketing/Navbar';
import { Footer } from '@/components/marketing/Footer';
import { ScrollProgressBar } from '@/components/marketing/ScrollProgressBar';

export function PrivacyView() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-zinc-100 overflow-x-hidden selection:bg-indigo-500 selection:text-white transition-colors duration-200">
      <ScrollProgressBar />
      <Navbar />

      <section className="pt-36 pb-16 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-mono mb-6">
            <Shield className="w-3.5 h-3.5" />
            <span>LAST UPDATED: NOVEMBER 2026</span>
          </div>

          <h1 className="font-display font-black text-4xl sm:text-6xl text-slate-900 dark:text-white tracking-tight leading-[1.05] mb-4">
            Privacy Policy & Data Sovereignty
          </h1>

          <p className="text-base text-slate-600 dark:text-zinc-400 max-w-xl mx-auto">
            Our guiding philosophy is simple: your team’s conversations, files, and intellectual property belong exclusively to you.
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 text-slate-700 dark:text-zinc-300 text-sm sm:text-base leading-relaxed space-y-10">
        <div className="p-8 rounded-3xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 shadow-lg space-y-4">
          <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
            1. The Self-Hosted Zero-Telemetry Guarantee
          </h2>
          <p>
            When you run Orbit using our official Docker Compose distribution or directly from source on your own VPS or private cloud, <strong>zero telemetry or conversation logs are sent back to Orbit or any third party</strong>.
          </p>
          <p>
            Orbit does not include Google Analytics, Facebook Pixels, Sentry phone-home telemetry, or hidden tracking beacons. Your user records, channels, direct messages, passwords, and file uploads are stored strictly in your local PostgreSQL database and disk volume.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
            2. Managed Cloud Services (Orbit Cloud Pro)
          </h2>
          <p>
            For customers utilizing our managed cloud infrastructure (Orbit Cloud Pro), we collect only the minimal data necessary to deliver the service:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-zinc-400">
            <li><strong>Account Information:</strong> Name, work email address, hashed passwords (salted with bcrypt, cost factor 12), and profile avatar URLs.</li>
            <li><strong>Workspace Tenancy Data:</strong> Workspace slugs, channel names, role permissions, and invite token records.</li>
            <li><strong>Operational Logs:</strong> Server connection timestamps and error diagnostics retained for 14 days solely for infrastructure health and DDoS mitigation.</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
            3. WebRTC Audio & Video Calling Privacy
          </h2>
          <p>
            Orbit audio and video calls are routed through a containerized WebRTC calling engine. Media streams (audio tracks, video frames, and screen share captures) are encrypted in transit using DTLS-SRTP.
          </p>
          <p>
            Orbit does <strong>not</strong> record, transcribe, or store audio/video calling streams on server disks unless the workspace administrator explicitly enables call archiving.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
            4. Bot Tokens & Developer API Integrity
          </h2>
          <p>
            Bot tokens generated via our developer portal (<code className="text-cyan-600 dark:text-cyan-400 font-mono">xoxb-...</code>) are cryptographically signed using HS256/RS256 JWT tokens with workspace-specific secret salts. You retain full control to revoke, rotate, or restrict tokens at any moment.
          </p>
        </div>

        <div className="space-y-4" id="security">
          <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
            5. Security & Encryption Standards
          </h2>
          <p>
            All network communication to Orbit instances is mandated over TLS 1.3. WebSocket connections upgrade through secure <code className="text-indigo-600 dark:text-indigo-400 font-mono">wss://</code> protocols. Databases are encrypted at rest with AES-256.
          </p>
        </div>

        <div className="space-y-4" id="subprocessors">
          <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
            6. Subprocessors
          </h2>
          <p>
            For customers on our managed Orbit Cloud Pro plan, we utilize tier-1 sovereign infrastructure providers including Hetzner Cloud (EU) and AWS (US-East). We maintain signed Data Processing Agreements (DPAs) in compliance with GDPR Art. 28.
          </p>
        </div>

        <div className="p-8 rounded-3xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 shadow-lg space-y-3">
          <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
            7. Data Protection Officer & Contact
          </h2>
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            For GDPR data subject access requests, deletion demands, or security inquiries, please email our security team directly:
          </p>
          <p className="font-mono text-cyan-600 dark:text-cyan-400 text-sm font-semibold">
            privacy@orbit.wondercraftz.dev
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
