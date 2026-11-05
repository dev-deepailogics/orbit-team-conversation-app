'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Trello,
  FolderKanban,
  Palette,
  PenTool,
} from 'lucide-react';

const SLIDES = [
  {
    id: 'kanban',
    title: 'Agile Ticket Management',
    subtitle: 'Kanban boards with columns, task priorities, due dates & member tags',
    badge: 'Tickets & Issues',
    icon: Trello,
    tagColor: 'from-rose-500 to-amber-500',
    src: '/screenshots/01-kanban-board.jpg',
  },
  {
    id: 'portfolio',
    title: 'Project Portfolio Hub',
    subtitle: 'Centralized directory of all active, inactive & delivered team projects',
    badge: 'Projects & Workspaces',
    icon: FolderKanban,
    tagColor: 'from-blue-500 to-cyan-500',
    src: '/screenshots/02-project-portfolio.jpg',
  },
  {
    id: 'themes',
    title: 'Custom Themes & Appearance',
    subtitle: 'Curated color palettes and customizable workspace themes (Light & Dark)',
    badge: 'Appearance & UI',
    icon: Palette,
    tagColor: 'from-emerald-500 to-teal-500',
    src: '/screenshots/03-theme-appearance.jpg',
  },
  {
    id: 'canvas',
    title: 'Infinite Whiteboard Canvas',
    subtitle: 'Real-time collaborative diagramming, flowcharts, sticky notes & connectors',
    badge: 'Whiteboard Canvas',
    icon: PenTool,
    tagColor: 'from-purple-500 to-indigo-500',
    src: '/screenshots/04-canvas-whiteboard.jpg',
  },
];

export function ProductMockup() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 3D Tilt values based on mouse coordinates
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [3, -3]), {
    stiffness: 150,
    damping: 25,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-4, 4]), {
    stiffness: 150,
    damping: 25,
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  // Continuous auto-movement every 3.8 seconds (never freezes or stops)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % SLIDES.length);
    }, 3800);
    return () => clearInterval(interval);
  }, []);

  const nextSlide = () => setCurrentIdx((prev) => (prev + 1) % SLIDES.length);
  const prevSlide = () => setCurrentIdx((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);

  const activeSlide = SLIDES[currentIdx];

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="perspective-1000 w-full max-w-6xl mx-auto py-6"
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-2xl sm:rounded-3xl p-1 bg-gradient-to-b from-indigo-500/30 via-white/10 to-transparent shadow-2xl shadow-indigo-950/60"
      >
        {/* Glow ambient background behind the mockup */}
        <div className="absolute -inset-4 bg-gradient-to-r from-indigo-600/20 via-cyan-500/20 to-purple-600/20 blur-2xl rounded-3xl -z-10 pointer-events-none" />

        {/* Window Chrome / Frame */}
        <div className="bg-[#121620] rounded-[22px] border border-white/10 overflow-hidden text-zinc-300">
          {/* Top Window Bar */}
          <div className="h-12 bg-[#0B0E17] px-4 flex items-center justify-between border-b border-white/10 select-none">
            {/* Window controls */}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="text-xs text-zinc-400 font-mono ml-3 hidden sm:inline flex items-center gap-2">
                <span className="text-zinc-500">orbit.app</span>
                <span className="text-zinc-600">/</span>
                <span className="text-indigo-400">{activeSlide.badge.toLowerCase().replace(/\s+/g, '-')}</span>
              </span>
            </div>

            {/* Slide Navigation Pills / Tab Switchers */}
            <div className="flex items-center gap-1 sm:gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
              {SLIDES.map((slide, idx) => {
                const SlideIcon = slide.icon;
                const isActive = idx === currentIdx;
                return (
                  <button
                    key={slide.id}
                    onClick={() => setCurrentIdx(idx)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <SlideIcon className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">{slide.badge}</span>
                  </button>
                );
              })}
            </div>

            {/* Slide Counter */}
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span className="text-indigo-400 font-bold">{currentIdx + 1}</span>
              <span className="text-zinc-600">/</span>
              <span>{SLIDES.length}</span>
            </div>
          </div>

          {/* Carousel Viewport Container: uncropped, pixel-sharp full image presentation */}
          <div className="relative w-full min-h-[420px] sm:min-h-[580px] lg:min-h-[640px] bg-[#0A0D14] flex items-center justify-center p-2 sm:p-4 group/image overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSlide.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="w-full flex items-center justify-center"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeSlide.src}
                  alt={activeSlide.title}
                  loading="eager"
                  decoding="sync"
                  className="w-full h-auto max-h-[680px] object-contain rounded-xl select-none shadow-2xl"
                  style={{ imageRendering: '-webkit-optimize-contrast' }}
                />
              </motion.div>
            </AnimatePresence>

            {/* Slide Carousel Arrow Controls */}
            <button
              onClick={prevSlide}
              aria-label="Previous slide"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-950/80 hover:bg-slate-900 border border-white/20 text-white flex items-center justify-center transition-all opacity-0 group-hover/image:opacity-100 hover:scale-110 backdrop-blur-md shadow-2xl z-20"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={nextSlide}
              aria-label="Next slide"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-950/80 hover:bg-slate-900 border border-white/20 text-white flex items-center justify-center transition-all opacity-0 group-hover/image:opacity-100 hover:scale-110 backdrop-blur-md shadow-2xl z-20"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Bottom Caption Overlay */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none z-20">
              <div className="bg-[#0C101A]/95 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-xl shadow-xl pointer-events-auto">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${activeSlide.tagColor}`} />
                  <p className="font-display font-bold text-sm text-white">
                    {activeSlide.title}
                  </p>
                </div>
                <p className="text-xs text-zinc-400 font-normal">
                  {activeSlide.subtitle}
                </p>
              </div>

              {/* Progress Indicator Dots */}
              <div className="hidden sm:flex items-center gap-1.5 bg-[#0C101A]/95 backdrop-blur-md border border-white/10 px-3 py-2 rounded-xl pointer-events-auto">
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIdx(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${
                      i === currentIdx ? 'w-7 bg-indigo-500' : 'w-2 bg-white/20 hover:bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
