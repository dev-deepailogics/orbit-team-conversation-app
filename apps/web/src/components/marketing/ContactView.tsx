'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Mail,
  MessageSquare,
  Clock,
  ShieldCheck,
  Disc as Discord,
  Github,
  MapPin,
  Sparkles,
} from 'lucide-react';

import { Navbar } from '@/components/marketing/Navbar';
import { Footer } from '@/components/marketing/Footer';
import { ScrollProgressBar } from '@/components/marketing/ScrollProgressBar';
import { ContactForm } from '@/components/marketing/ContactForm';
import { FaqAccordion } from '@/components/marketing/FaqAccordion';

export function ContactView() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-zinc-100 overflow-x-hidden selection:bg-indigo-500 selection:text-white transition-colors duration-200">
      <ScrollProgressBar />
      <Navbar />

      {/* Hero Header */}
      <section className="pt-36 pb-12 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
        <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[650px] h-[350px] bg-gradient-to-tr from-indigo-600/20 via-cyan-500/20 to-purple-500/15 blur-[130px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-mono mb-6">
            <Sparkles className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
            <span>DIRECT ACCESS TO PLATFORM ARCHITECTS</span>
          </div>

          <h1 className="font-display font-black text-4xl sm:text-6xl text-slate-900 dark:text-white tracking-tight leading-[1.05] mb-6">
            Let's talk infrastructure & team collaboration
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Whether you need assistance with custom self-hosted Docker clusters, high-volume audio & video calling scale, or enterprise SLAs, our core engineering team is here to help.
          </p>
        </div>
      </section>

      {/* Main Split Section: Details + Form */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Contact Cards & Info */}
          <div className="lg:col-span-5 space-y-6">
            {/* Direct Support Card */}
            <div className="p-8 rounded-3xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 shadow-xl space-y-6">
              <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white">
                Direct Engineering Channels
              </h3>

              <div className="space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-cyan-400 shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-mono text-slate-500 dark:text-zinc-400 uppercase tracking-wider">General & Architecture</p>
                    <a
                      href="mailto:contact@orbit.wondercraftz.dev"
                      className="text-sm font-semibold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      contact@orbit.wondercraftz.dev
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 dark:bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-mono text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Response Time SLA</p>
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Average response in &lt; 2 hours</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 dark:bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-mono text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Global Headquarters</p>
                    <p className="text-sm text-slate-700 dark:text-zinc-300">San Francisco, CA & Remote Global</p>
                  </div>
                </div>
              </div>

              {/* Social Channels */}
              <div className="pt-6 border-t border-slate-200 dark:border-white/10 flex items-center gap-3">
                <a
                  href="https://discord.com"
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 text-xs font-mono font-medium text-slate-900 dark:text-white flex items-center justify-center gap-2 transition-colors border border-slate-200 dark:border-white/5"
                >
                  <Discord className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  <span>Discord Community</span>
                </a>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 text-xs font-mono font-medium text-slate-900 dark:text-white flex items-center justify-center gap-2 transition-colors border border-slate-200 dark:border-white/5"
                >
                  <Github className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                  <span>GitHub Issues</span>
                </a>
              </div>
            </div>

            {/* Security Notice */}
            <div className="p-6 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/30 flex items-start gap-3 text-xs text-indigo-950 dark:text-indigo-200">
              <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 dark:text-white block mb-0.5">Enterprise Security & Compliance:</strong>
                Looking to deploy Orbit across your enterprise organization with custom compliance, data sovereignty, and priority support? Reach out to our dedicated support team.
              </div>
            </div>
          </div>

          {/* Right Column: Contact Form with Validation */}
          <div className="lg:col-span-7">
            <ContactForm />
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-mono mb-4">
            <span>FREQUENTLY ASKED QUESTIONS</span>
          </div>
          <h2 className="font-display font-black text-3xl sm:text-4xl text-slate-900 dark:text-white tracking-tight">
            Common questions about Orbit
          </h2>
        </div>

        <FaqAccordion />
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
