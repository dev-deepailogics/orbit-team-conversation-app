// Sample whiteboard drawings for demo workspaces.
import type { Key } from './demoWorkspace.js';

// Element shape mirrors CanvasElement in apps/web/src/components/whiteboard/WhiteboardView.tsx.

const STICKY = {
  yellow: ['#FEF08A', '#713F12'],
  blue: ['#BAE6FD', '#0C4A6E'],
  green: ['#BBF7D0', '#14532D'],
  pink: ['#FBCFE8', '#831843'],
  purple: ['#DDD6FE', '#4C1D95'],
  orange: ['#FED7AA', '#7C2D12'],
} as const;
const INK = '#FFFFFF'; // the whiteboard swaps white for the theme's text colour

let n = 0;
const id = (t: string) => `${t}-demo-${++n}`;

const sticky = (x: number, y: number, text: string, c: keyof typeof STICKY = 'yellow') => ({
  id: id('sticky'), type: 'sticky', x, y, width: 180, height: 180,
  color: STICKY[c][1], fillColor: STICKY[c][0], strokeWidth: 2, fontSize: 18, text,
});
const text = (x: number, y: number, value: string, fontSize = 18, width = 360) => ({
  id: id('text'), type: 'text', x, y, width, height: 48, color: INK, strokeWidth: 1, fontSize, isBold: true, text: value,
});
const box = (x: number, y: number, width: number, height: number, color = '#3B82F6') => ({
  id: id('rect'), type: 'rect', x, y, width, height, color, strokeWidth: 3,
});
const arrow = (x1: number, y1: number, x2: number, y2: number, color = INK) => ({
  id: id('arrow'), type: 'arrow', x: x1, y: y1, points: [{ x: x1, y: y1 }, { x: x2, y: y2 }], color, strokeWidth: 3,
});
// A box with a label inside it.
const node = (x: number, y: number, w: number, h: number, label: string, color?: string) => [
  box(x, y, w, h, color),
  text(x + 14, y + h / 2 - 22, label, 16, w - 24),
];

export const DEMO_CANVASES: { title: string; channel?: string; project?: string; by: Key; elements: object[] }[] = [
  {
    title: 'Sprint Retrospective',
    channel: 'engineering',
    by: 'pm',
    elements: [
      text(80, 0, 'Sprint 14 Retrospective', 30, 600),
      text(80, 70, '🟢 What went well', 22),
      text(480, 70, '🟠 What to improve', 22),
      text(880, 70, '🔵 Action items', 22),
      sticky(80, 130, 'Shipped the auth flow ahead of schedule', 'green'),
      sticky(80, 340, 'Super fast QA turnaround on bugs', 'green'),
      sticky(480, 130, 'Too many meetings mid-sprint', 'orange'),
      sticky(480, 340, 'API spec arrived late', 'orange'),
      sticky(880, 130, 'Try no-meeting Wednesdays', 'blue'),
      sticky(880, 340, 'Freeze the API spec before sprint start', 'blue'),
    ],
  },
  {
    title: 'Homepage Wireframe',
    project: 'Website Redesign',
    by: 'designer',
    elements: [
      text(80, 0, 'Homepage Wireframe v2', 28, 600),
      ...node(80, 70, 900, 60, 'Logo · Product · Pricing · Blog · Contact', '#8B5CF6'),
      box(80, 150, 900, 260, '#3B82F6'),
      text(120, 200, 'Hero: headline + product screenshot', 22, 600),
      ...node(120, 320, 180, 50, 'Book a demo', '#10B981'),
      ...node(80, 430, 280, 160, 'Feature: Channels & DMs', '#F59E0B'),
      ...node(390, 430, 280, 160, 'Feature: Projects & Kanban', '#F59E0B'),
      ...node(700, 430, 280, 160, 'Feature: Huddles & Canvas', '#F59E0B'),
      ...node(80, 610, 900, 70, 'Footer: links · social · newsletter', '#6B7280'),
      sticky(1040, 150, 'Option B approved by the client ✅', 'green'),
      sticky(1040, 370, 'Try a darker hero background variant', 'pink'),
      arrow(1035, 240, 990, 240, '#EC4899'),
    ],
  },
  {
    title: 'Launch Campaign Brainstorm',
    channel: 'marketing',
    by: 'marketing',
    elements: [
      text(380, 0, 'Launch Campaign Brainstorm', 28, 600),
      ...node(430, 260, 240, 100, '🚀 Q4 Product Launch', '#F59E0B'),
      sticky(80, 60, 'Customer story video', 'pink'),
      sticky(80, 420, 'Webinar with a live demo', 'purple'),
      sticky(820, 60, 'LinkedIn countdown posts', 'blue'),
      sticky(820, 420, 'Partner co-marketing', 'green'),
      sticky(460, 470, 'Early-bird discount for 2 weeks', 'yellow'),
      arrow(430, 280, 265, 160),
      arrow(430, 340, 265, 470),
      arrow(670, 280, 815, 160),
      arrow(670, 340, 815, 470),
      arrow(550, 360, 550, 465),
    ],
  },
  {
    title: 'Onboarding User Flow',
    project: 'Mobile App v2',
    by: 'designer',
    elements: [
      text(80, 0, 'New Onboarding Flow', 28, 600),
      ...['Splash', 'Sign up', 'Verify email', 'Pick interests', 'Home'].flatMap((label, i) => [
        ...node(80 + i * 230, 100, 180, 90, label, i === 4 ? '#10B981' : '#3B82F6'),
        ...(i < 4 ? [arrow(260 + i * 230, 145, 310 + i * 230, 145)] : []),
      ]),
      ...node(540, 280, 180, 90, 'Resend code', '#EF4444'),
      arrow(630, 190, 630, 275, '#EF4444'),
      sticky(80, 260, 'Skip "Pick interests" for returning users', 'yellow'),
      sticky(800, 260, 'Add Google sign-in in v2.1', 'purple'),
    ],
  },
];
