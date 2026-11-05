'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Mail,
  MessageSquare,
  Clock,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface FormState {
  name: string;
  email: string;
  subject: string;
  teamSize: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

export function ContactForm() {
  const [formData, setFormData] = useState<FormState>({
    name: '',
    email: '',
    subject: 'Self-Hosted Enterprise Support',
    teamSize: '10-50',
    message: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [shake, setShake] = useState(false);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Work email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid work email address';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Please provide details about your inquiry';
    } else if (formData.message.length < 15) {
      newErrors.message = 'Message must be at least 15 characters long';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      // Trigger error shake animation
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setIsSubmitting(true);
    // Simulate API submission
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {isSubmitted ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-zinc-900/90 border border-emerald-500/30 text-center shadow-2xl relative overflow-hidden"
          >
            {/* Ambient emerald glow */}
            <div className="absolute inset-0 bg-emerald-500/5 blur-2xl pointer-events-none" />

            {/* Animated SVG Checkmark */}
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                <motion.path
                  d="M 5 13 L 10 18 L 19 7"
                  stroke="#10B981"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.6, ease: 'easeInOut' }}
                />
              </svg>
            </div>

            <h3 className="font-display font-black text-2xl sm:text-3xl text-slate-900 dark:text-white mb-2">
              Message Received by Engineering Team!
            </h3>
            <p className="text-slate-600 dark:text-zinc-400 max-w-md mx-auto text-sm leading-relaxed mb-8">
              Thank you, <strong className="text-slate-900 dark:text-white">{formData.name}</strong>. A senior platform architect will review your inquiry and reply to <strong className="text-indigo-600 dark:text-indigo-400">{formData.email}</strong> in under 2 hours.
            </p>

            <button
              onClick={() => {
                setIsSubmitted(false);
                setFormData({
                  name: '',
                  email: '',
                  subject: 'Self-Hosted Enterprise Support',
                  teamSize: '10-50',
                  message: '',
                });
              }}
              className="px-6 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-900 dark:text-white text-xs font-mono transition-colors"
            >
              Send Another Inquiry
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            animate={shake ? { x: [-10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
            className="p-8 sm:p-10 rounded-3xl bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-white/10 shadow-2xl space-y-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Full Name Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-zinc-400">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (errors.name) setErrors({ ...errors, name: undefined });
                  }}
                  placeholder="e.g. Maya Chen"
                  className={`w-full bg-slate-50 dark:bg-zinc-950/80 border rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none transition-colors ${
                    errors.name ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-white/10 focus:border-indigo-500'
                  }`}
                />
                {errors.name && (
                  <p className="text-xs text-rose-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{errors.name}</span>
                  </p>
                )}
              </div>

              {/* Work Email Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-zinc-400">
                  Work Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  placeholder="maya@enterprise.com"
                  className={`w-full bg-slate-50 dark:bg-zinc-950/80 border rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none transition-colors ${
                    errors.email ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-white/10 focus:border-indigo-500'
                  }`}
                />
                {errors.email && (
                  <p className="text-xs text-rose-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{errors.email}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Subject Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-zinc-400">
                  Topic / Area
                </label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-zinc-950/80 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="Self-Hosted Enterprise Support">Self-Hosted Enterprise Support</option>
                  <option value="Slack Migration & Bot Token Compatibility">Slack Migration & Bot API</option>
                  <option value="LiveKit SFU Architecture Consultation">Audio & Video Calling Scale Consultation</option>
                  <option value="Security Audit & Air-Gapped Deployment">Air-Gapped & Security Audit</option>
                  <option value="General Question">General Question</option>
                </select>
              </div>

              {/* Team Size */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-zinc-400">
                  Team Size
                </label>
                <select
                  value={formData.teamSize}
                  onChange={(e) => setFormData({ ...formData, teamSize: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-zinc-950/80 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="1-10">1 - 10 engineers</option>
                  <option value="10-50">10 - 50 engineers</option>
                  <option value="50-250">50 - 250 engineers</option>
                  <option value="250-1000">250 - 1,000 engineers</option>
                  <option value="1000+">1,000+ enterprise scale</option>
                </select>
              </div>
            </div>

            {/* Message Area */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-zinc-400">
                Message & Infrastructure Details *
              </label>
              <textarea
                rows={4}
                value={formData.message}
                onChange={(e) => {
                  setFormData({ ...formData, message: e.target.value });
                  if (errors.message) setErrors({ ...errors, message: undefined });
                }}
                placeholder="Tell us about your team's requirements, current messaging pain points, or self-hosted deployment timeline..."
                className={`w-full bg-slate-50 dark:bg-zinc-950/80 border rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none transition-colors ${
                  errors.message ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-white/10 focus:border-indigo-500'
                }`}
              />
              {errors.message && (
                <p className="text-xs text-rose-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{errors.message}</span>
                </p>
              )}
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileHover={{ scale: 1.01, boxShadow: "0 12px 30px -10px rgba(99, 102, 241, 0.4)" }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 text-white font-semibold text-sm hover:opacity-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 disabled:opacity-50 relative overflow-hidden group"
            >
              <motion.div
                className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none"
              />
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Submit Inquiry to Platform Engineering</span>
                  <motion.div
                    animate={{ x: [0, 3, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  >
                    <Send className="w-4 h-4 text-cyan-200" />
                  </motion.div>
                </>
              )}
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

