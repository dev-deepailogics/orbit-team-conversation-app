'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import {
  Layers,
  Menu,
  X,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Github,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface NavLinkItem {
  label: string;
  href: string;
  badge?: string;
}

const NAV_LINKS: NavLinkItem[] = [
  { label: 'Features', href: '/features' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export function Navbar() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const previous = scrollY.getPrevious() || 0;
    if (latest > 120 && latest > previous) {
      setHidden(true);
    } else {
      setHidden(false);
    }
    setScrolled(latest > 20);
  });

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <motion.header
        variants={{
          visible: { y: 0, opacity: 1 },
          hidden: { y: -90, opacity: 0 },
        }}
        animate={hidden ? 'hidden' : 'visible'}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 left-0 right-0 z-40 transition-colors duration-200 ${
          scrolled
            ? 'bg-white/85 dark:bg-zinc-950/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/10 shadow-sm dark:shadow-black/20'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 py-3.5 flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group focus:outline-none"
            aria-label="Orbit Home"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow">
              <div className="w-full h-full bg-white dark:bg-zinc-950 rounded-[11px] flex items-center justify-center">
                <Layers className="w-5 h-5 text-indigo-500 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-display font-black text-xl tracking-tight text-slate-900 dark:text-white">
                ORBIT
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/90 dark:bg-zinc-900/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/10 shadow-inner">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-slate-900 dark:text-white font-semibold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNavIndicator"
                      className="absolute inset-0 bg-white dark:bg-white/10 rounded-full shadow-sm dark:shadow-none"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {link.label}
                    {link.badge && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/15 dark:bg-indigo-500/30 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30">
                        {link.badge}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Sign in */}
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center px-3.5 py-1.5 text-sm font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Sign In
            </Link>

            {/* Primary Launch CTA */}
            <Link
              href="/app"
              className="relative group overflow-hidden rounded-full p-[1px] font-medium text-sm focus:outline-none"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 rounded-full animate-gradient opacity-90 group-hover:opacity-100 transition-opacity" />
              <span className="relative px-4 py-2 rounded-full bg-indigo-600 text-white dark:bg-zinc-950 dark:text-white flex items-center gap-1.5 group-hover:bg-opacity-90 transition-all font-semibold shadow-sm">
                <span>Open Orbit</span>
                <ArrowRight className="w-4 h-4 text-cyan-200 dark:text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg bg-slate-100 dark:bg-zinc-900/80 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white"
              aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 top-18 z-30 lg:hidden bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl px-6 py-8 flex flex-col justify-between overflow-y-auto"
          >
            <div className="space-y-4">
              <p className="text-xs uppercase font-semibold text-slate-500 dark:text-zinc-500 tracking-wider">
                Navigation
              </p>
              <nav className="flex flex-col space-y-2">
                {NAV_LINKS.map((link, idx) => (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Link
                      href={link.href}
                      className="flex items-center justify-between text-lg font-medium text-slate-800 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 py-2 border-b border-slate-200 dark:border-white/5"
                    >
                      <span>{link.label}</span>
                      {link.badge && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 dark:border-indigo-500/30">
                          {link.badge}
                        </span>
                      )}
                    </Link>
                  </motion.div>
                ))}
              </nav>
            </div>

            <div className="pt-8 border-t border-slate-200 dark:border-white/10 space-y-3">
              <Link
                href="/login"
                className="w-full py-3 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-center font-medium text-slate-900 dark:text-zinc-200 block"
              >
                Sign In to Workspace
              </Link>
              <Link
                href="/app"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-center font-semibold text-white flex items-center justify-center gap-2"
              >
                <span>Launch Interactive Demo</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

