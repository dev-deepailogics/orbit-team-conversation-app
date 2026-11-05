'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Layers,
  Github,
  Twitter,
  Disc as Discord,
  Linkedin,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Server,
  Zap,
} from 'lucide-react';

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Real-time Channels', href: '/features#channels' },
      { label: 'Audio & Video Calling', href: '/features' },
      { label: 'Message Threads', href: '/features#threads' },
      { label: 'Bot & Webhook API', href: '/features#bots' },
      { label: 'Project Boards', href: '/features#projects' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'System Architecture', href: '/about#architecture' },
      { label: 'Self-Hosting Specs', href: 'https://github.com' },
      { label: 'Data Sovereignty', href: '/about#sovereignty' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Orbit', href: '/about' },
      { label: 'Manifesto', href: '/about#manifesto' },
      { label: 'Contact Us', href: '/contact' },
      { label: 'Careers', href: '/about#careers' },
      { label: 'Brand Assets', href: '/about' },
    ],
  },
  {
    title: 'Legal & Trust',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Security Overview', href: '/privacy#security' },
      { label: 'Subprocessors', href: '/privacy#subprocessors' },
    ],
  },
];

export function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <footer className="relative bg-slate-100 dark:bg-zinc-950 border-t border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 text-sm overflow-hidden transition-colors">
      {/* Background ambient glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[250px] bg-gradient-to-t from-indigo-900/15 via-cyan-900/10 to-transparent blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 relative z-10">
        {/* Top Newsletter & Brand Header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pb-14 border-b border-slate-200 dark:border-white/10">
          <div className="lg:col-span-5 space-y-4">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-md shadow-indigo-500/20">
                <div className="w-full h-full bg-white dark:bg-zinc-950 rounded-[11px] flex items-center justify-center">
                  <Layers className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                </div>
              </div>
              <span className="font-display font-black text-xl tracking-tight text-slate-900 dark:text-white">
                ORBIT
              </span>
            </Link>

            <p className="text-slate-600 dark:text-zinc-400 max-w-sm text-sm leading-relaxed">
              The high-performance, open-source team communication platform. Self-hostable, end-to-end encrypted voice and video calling, and fully Slack-compatible bot engine.
            </p>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className="max-w-md lg:ml-auto">
              <h4 className="font-display font-bold text-slate-900 dark:text-white text-base mb-2">
                Get developer changelogs & release notes
              </h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                No marketing spam. Only engineering breakthroughs, security advisories, and architecture RFCs.
              </p>

              {subscribed ? (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>You are subscribed! Check your inbox for the release newsletter.</span>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex gap-2">
                  <input
                    type="email"
                    required
                    placeholder="architect@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 bg-white dark:bg-zinc-900/90 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors shadow-sm"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors flex items-center gap-1.5 shrink-0 shadow-lg shadow-indigo-600/20"
                  >
                    <span>Subscribe</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Middle Links Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-14">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title} className="space-y-3">
              <h4 className="font-display font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-zinc-200">
                {col.title}
              </h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-xs text-slate-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-block"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar: Copyright & Socials */}
        <div className="pt-8 border-t border-slate-200 dark:border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-slate-500 dark:text-zinc-500">
            <span>© {new Date().getFullYear()} Orbit Inc. Open-source core.</span>
            <span className="hidden sm:inline">•</span>
            <span>Crafted for engineering teams worldwide.</span>
          </div>

          <div className="flex items-center gap-4 text-slate-600 dark:text-zinc-400">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-white/5 shadow-sm"
              aria-label="GitHub Repository"
            >
              <Github className="w-4 h-4" />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-white/5 shadow-sm"
              aria-label="X (Twitter)"
            >
              <Twitter className="w-4 h-4" />
            </a>
            <a
              href="https://discord.com"
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-white/5 shadow-sm"
              aria-label="Discord Community"
            >
              <Discord className="w-4 h-4" />
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-white/5 shadow-sm"
              aria-label="LinkedIn"
            >
              <Linkedin className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

