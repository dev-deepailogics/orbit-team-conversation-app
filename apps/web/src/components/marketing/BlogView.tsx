'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Clock,
  Calendar,
  ArrowRight,
  User,
  Sparkles,
  Search,
  Tag,
} from 'lucide-react';

import { Navbar } from '@/components/marketing/Navbar';
import { Footer } from '@/components/marketing/Footer';
import { ScrollProgressBar } from '@/components/marketing/ScrollProgressBar';
import { CtaBanner } from '@/components/marketing/CtaBanner';

const POSTS = [
  {
    slug: 'benchmarking-livekit-sfu-webrtc',
    title: 'Benchmarking LiveKit SFU vs P2P Mesh for 50-Person Engineering Huddles',
    excerpt:
      'Why peer-to-peer WebRTC fails after 6 participants, and how a containerized Selective Forwarding Unit preserves client bandwidth and ensures sub-50ms audio latency.',
    category: 'Engineering',
    readTime: '7 min read',
    date: 'Nov 1, 2026',
    author: 'Elena Rostova',
    authorRole: 'Staff Audio/Video Engineer',
    featured: true,
  },
  {
    slug: 'migrating-slack-bots-to-orbit',
    title: 'Migrating 200+ Slack Bots and Incoming Webhooks to Orbit in 15 Minutes',
    excerpt:
      'How Orbit’s drop-in Slack xoxb- token emulation allows your CI/CD pipelines, Sentry alerts, and custom bots to switch endpoints without changing payload formats.',
    category: 'Tutorials',
    readTime: '5 min read',
    date: 'Oct 26, 2026',
    author: 'Affan Siddiqui',
    authorRole: 'Founding Engineer',
    featured: false,
  },
  {
    slug: 'redis-cursor-pagination-fastify',
    title: 'How We Replaced In-Memory Caching with Redis 7 to Cut Socket Latency to 11ms',
    excerpt:
      'A deep dive into our Node.js Fastify backend architecture, cursor-based PostgreSQL pagination, and Redis pub/sub socket clustering.',
    category: 'Architecture',
    readTime: '9 min read',
    date: 'Oct 18, 2026',
    author: 'Julian Drake',
    authorRole: 'Principal Systems Architect',
    featured: false,
  },
  {
    slug: 'zero-telemetry-team-chat',
    title: 'Zero-Telemetry Team Chat: An Architecture Guide for Regulated Industries',
    excerpt:
      'Building a modern communication environment for defense, healthcare, and finance without third-party tracking pixels or LLM training backdoors.',
    category: 'Security',
    readTime: '6 min read',
    date: 'Oct 8, 2026',
    author: 'Dr. Sarah Lin',
    authorRole: 'Security Lead',
    featured: false,
  },
  {
    slug: 'multi-tenant-workspace-routing',
    title: 'Dynamic Subdomains & Vanity URL Multi-Tenancy in Next.js 14 App Router',
    excerpt:
      'How we architected custom workspace URLs with Next.js middleware, cookie encryption, and single sign-on token handshakes.',
    category: 'Engineering',
    readTime: '8 min read',
    date: 'Sep 29, 2026',
    author: 'Elena Rostova',
    authorRole: 'Staff Engineer',
    featured: false,
  },
  {
    slug: 'vps-deployment-docker-guide',
    title: 'Running Orbit in Production on a $20 VPS: Sizing, Backups, and Reverse Proxy',
    excerpt:
      'Everything you need to know about spinning up Orbit with Docker Compose, Nginx SSL certificates, and automated PostgreSQL backup cron jobs.',
    category: 'DevOps',
    readTime: '5 min read',
    date: 'Sep 19, 2026',
    author: 'Affan Siddiqui',
    authorRole: 'Founding Engineer',
    featured: false,
  },
];

const CATEGORIES = ['All', 'Engineering', 'Architecture', 'Tutorials', 'Security', 'DevOps'];

export function BlogView() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPosts = POSTS.filter((post) => {
    const matchesCategory =
      selectedCategory === 'All' || post.category === selectedCategory;
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredPost = POSTS.find((p) => p.featured) || POSTS[0];

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
            <span>ENGINEERING LOGS & ARCHITECTURE RFCs</span>
          </div>

          <h1 className="font-display font-black text-4xl sm:text-6xl lg:text-7xl text-slate-900 dark:text-white tracking-tight leading-[1.05] mb-6">
            Orbit Engineering & Resources
          </h1>

          <p className="text-base sm:text-xl text-slate-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-8">
            Technical deep dives into WebRTC SFU scalability, low-latency socket pipelines, and self-hosted team infrastructure.
          </p>

          {/* Search bar */}
          <div className="max-w-md mx-auto relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search technical articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/10 rounded-full pl-11 pr-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
            />
          </div>
        </div>
      </section>

      {/* Featured Article Card */}
      {selectedCategory === 'All' && !searchQuery && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-indigo-50 via-white to-slate-50 dark:from-indigo-950/60 dark:via-zinc-900/80 dark:to-zinc-900/80 border border-indigo-200 dark:border-indigo-500/30 shadow-2xl relative overflow-hidden group">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-200 border border-indigo-500/30 font-semibold">
                Featured Deep Dive
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{featuredPost.readTime}</span>
              </span>
            </div>

            <h2 className="font-display font-black text-2xl sm:text-4xl text-slate-900 dark:text-white mb-4 group-hover:text-indigo-600 dark:group-hover:text-cyan-300 transition-colors">
              {featuredPost.title}
            </h2>

            <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-300 max-w-3xl leading-relaxed mb-8">
              {featuredPost.excerpt}
            </p>

            <div className="flex items-center justify-between border-t border-slate-200 dark:border-white/10 pt-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-700 dark:text-cyan-300 font-bold text-xs">
                  {featuredPost.author.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{featuredPost.author}</p>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">{featuredPost.authorRole}</p>
                </div>
              </div>

              <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform font-bold">
                <span>Read Full Paper</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Category Filter Chips */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-mono transition-colors ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Articles Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredPosts.map((post) => (
            <div
              key={post.slug}
              className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 hover:border-indigo-500/40 transition-colors shadow-xl flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-zinc-400 mb-4">
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-cyan-600 dark:text-cyan-400 font-semibold">
                    {post.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{post.readTime}</span>
                  </div>
                </div>

                <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-3 leading-snug">
                  {post.title}
                </h3>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mb-6">
                  {post.excerpt}
                </p>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                <span className="font-mono">{post.date}</span>
                <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform font-mono font-medium">
                  <span>Read Article</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA Banner */}
      <CtaBanner />

      {/* Footer */}
      <Footer />
    </div>
  );
}
