'use client';

import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';

const BRANDS = [
  { name: 'Fastify', label: 'Fastify Core', tag: 'Fast Backend' },
  { name: 'Docker', label: 'Docker Container', tag: 'Self-hosted' },
  { name: 'Redis', label: 'Redis Cache', tag: 'Pub/Sub' },
  { name: 'Next.js', label: 'Next.js 14', tag: 'Fullstack' },
  { name: 'TailwindCSS', label: 'Tailwind CSS', tag: 'Styles' },
  { name: 'PostgreSQL', label: 'PostgreSQL 16', tag: 'Database' },
  { name: 'Socket.IO', label: 'Socket.IO', tag: 'Realtime' },
];

export function LogoMarquee() {
  return null;
}

