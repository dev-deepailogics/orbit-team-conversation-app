import { prisma } from '@orbit/db';
import bcrypt from 'bcryptjs';
import { randomBytes, randomInt } from 'crypto';
import { ACTIVITY_CHANNEL, ACTIVITY_CHANNEL_TOPIC } from './systemBot.js';
import { generateRandomPersona } from './anonymousService.js';
import { DEMO_CANVASES } from './demoCanvases.js';

// Demo accounts live at <key>@<slug>.demo, so the email alone tells which demo workspace a user belongs to.
export const demoEmailDomain = (slug: string) => `${slug}.demo`;

export const isDemoEmail = (email: string) => email.toLowerCase().endsWith('.demo');

// True when a demo user would be leaking into a workspace other than their own.
export function isForeignDemoUser(email: string, workspaceSlug: string) {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return isDemoEmail(domain) && domain !== demoEmailDomain(workspaceSlug);
}

export type Key =
  | 'owner' | 'admin' | 'pm' | 'designer' | 'engineer' | 'backend'
  | 'mobile' | 'qa' | 'marketing' | 'sales' | 'hr' | 'guest';
type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';

// "local" = Pakistani client (Asian Muslim names), "international" = western client.
export const DEMO_REGIONS = ['local', 'international'] as const;
export type DemoRegion = (typeof DEMO_REGIONS)[number];

// Statuses use the app's predefined set (BREAK_PRESETS in apps/web/src/components/availability/breakStatus.ts).
const MEETING: [string, string] = ['Meeting / Discussion', '🗓️'];
const ROLES: { key: Key; role: Role; title: string; status?: [string, string] }[] = [
  { key: 'owner', role: 'OWNER', title: 'CEO & Founder' },
  { key: 'admin', role: 'ADMIN', title: 'Head of Operations' },
  { key: 'pm', role: 'MEMBER', title: 'Project Manager', status: MEETING },
  { key: 'designer', role: 'MEMBER', title: 'Product Designer', status: ['Tea Break', '☕'] },
  { key: 'engineer', role: 'MEMBER', title: 'Frontend Engineer' },
  { key: 'backend', role: 'MEMBER', title: 'Backend Engineer' },
  { key: 'mobile', role: 'MEMBER', title: 'Mobile Engineer', status: ['Lunch', '🍽️'] },
  { key: 'qa', role: 'MEMBER', title: 'QA Engineer' },
  { key: 'marketing', role: 'MEMBER', title: 'Marketing Lead' },
  { key: 'sales', role: 'MEMBER', title: 'Sales Executive', status: MEETING },
  { key: 'hr', role: 'MEMBER', title: 'HR Manager' },
  { key: 'guest', role: 'GUEST', title: 'Client (external guest)' },
];

// First names must be unique per region: usernames are `<first>_<slug>`.
export const NAMES: Record<DemoRegion, Record<Key, string>> = {
  local: {
    owner: 'Ahmed Raza',
    admin: 'Ayesha Khan',
    pm: 'Bilal Hussain',
    designer: 'Fatima Malik',
    engineer: 'Hamza Siddiqui',
    backend: 'Usman Tariq',
    mobile: 'Zainab Qureshi',
    qa: 'Omar Farooq',
    marketing: 'Maryam Sheikh',
    sales: 'Hassan Ali',
    hr: 'Sana Javed',
    guest: 'Imran Chaudhry',
  },
  international: {
    owner: 'Olivia Bennett',
    admin: 'Marcus Reid',
    pm: 'Sophie Turner',
    designer: 'Priya Shah',
    engineer: 'Daniel Kim',
    backend: 'Lucas Martin',
    mobile: 'Emma Wilson',
    qa: 'Noah Fischer',
    marketing: 'Chloe Dubois',
    sales: 'James Carter',
    hr: 'Isabella Rossi',
    guest: 'Alex Morgan',
  },
};

const TEAM: Key[] = ROLES.map((r) => r.key).filter((k) => k !== 'guest');
const EVERYONE: Key[] = [...TEAM, 'guest'];
const ENGINEERS: Key[] = ['admin', 'pm', 'engineer', 'backend', 'mobile', 'qa'];

// Same defaults a project gets when created through the API (routes/projects.ts).
const COLUMNS = [
  { name: 'Todo', color: '#3B82F6', orderIndex: 0 },
  { name: 'Inprogress', color: '#F59E0B', orderIndex: 1 },
  { name: 'In review', color: '#8B5CF6', orderIndex: 2 },
  { name: 'Done', color: '#10B981', orderIndex: 3 },
];

type Msg = {
  by: Key | 'bot';
  text: string;
  ago: number; // minutes before now
  pinned?: boolean;
  reactions?: [string, Key[]][];
  replies?: { by: Key; text: string }[];
};

type TicketSpec = {
  col: 0 | 1 | 2 | 3;
  title: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  who: Key;
  labels: string[];
  due: number; // days from now (negative = past)
  points?: number;
  desc?: string;
  checklist?: [string, boolean][];
  comments?: [Key, string][];
};

const MIN = 1;
const HOUR = 60;
const DAY = 24 * HOUR;
const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000);

// 8 chars with at least one upper, lower, digit and symbol. Look-alikes (0/O, 1/l/I) left out so it can be read aloud.
export function strongPassword() {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%&*?'];
  const all = sets.join('');
  const pick = (s: string) => s[randomInt(s.length)];
  const chars = [...sets.map(pick), ...Array.from({ length: 4 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

async function pickSlug(name: string) {
  const base =
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'demo';
  const taken = async (s: string) =>
    (await prisma.workspace.count({ where: { slug: s } })) > 0 ||
    (await prisma.user.count({ where: { email: { endsWith: `@${demoEmailDomain(s)}` } } })) > 0;
  let slug = base;
  while (await taken(slug)) slug = `${base}-${randomBytes(2).toString('hex')}`;
  return slug;
}

export async function createDemoWorkspace(name: string, region: DemoRegion = 'international') {
  const PEOPLE = ROLES.map((r) => ({
    ...r,
    name: NAMES[region][r.key],
    status: region === 'local' && r.key === 'qa' ? (['Namaz', '🕌'] as [string, string]) : r.status,
  }));
  const slug = await pickSlug(name);
  const password = strongPassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const domain = demoEmailDomain(slug);

  const workspace = await prisma.$transaction(
    async (tx) => {
      // ---------- Users (one per workspace role, never shared across demos) ----------
      const u = {} as Record<Key, { id: string; username: string; displayName: string; first: string }>;
      for (const p of PEOPLE) {
        const first = p.name.split(' ')[0];
        const username = `${first.toLowerCase()}_${slug}`;
        const user = await tx.user.create({
          data: {
            email: `${p.key}@${domain}`,
            username,
            displayName: p.name,
            passwordHash,
            avatarUrl: `/api/avatar/avataaars/svg?seed=${encodeURIComponent(username)}`,
            customStatusText: p.status?.[0],
            customStatusEmoji: p.status?.[1],
          },
        });
        u[p.key] = { id: user.id, username, displayName: p.name, first };
      }
      const mention = (k: Key) => `@${u[k].username}`;

      // ---------- Workspace + bot ----------
      const ws = await tx.workspace.create({
        data: {
          name,
          slug,
          iconUrl: `/api/avatar/identicon/svg?seed=${slug}`,
          ownerId: u.owner.id,
          settings: { isDemo: true, demoRegion: region },
          members: { create: PEOPLE.map((p) => ({ userId: u[p.key].id, role: p.role })) },
        },
      });

      // Same name as getOrCreateSystemBot() so later bot notifications reuse it.
      const bot = await tx.botApp.create({
        data: {
          workspaceId: ws.id,
          name: 'Orbit Bot',
          description: 'Default Orbit system notifications and activity alerts',
          avatarUrl: '/api/avatar/bottts/svg?seed=OrbitSystemBot&backgroundColor=007a5a',
          botToken: `orb_sys_${randomBytes(8).toString('hex')}_${Date.now()}`,
          scopes: ['chat:write', 'system'],
          createdById: u.owner.id,
        },
      });

      // ---------- Channels ----------
      const CHANNELS: {
        key: string;
        name: string;
        topic: string;
        description?: string;
        type?: 'PUBLIC' | 'PRIVATE' | 'DIRECT';
        isAnonymous?: boolean;
        members: Key[];
        by?: Key;
      }[] = [
        { key: 'general', name: 'general', topic: 'Company-wide announcements and work-based matters', members: EVERYONE },
        { key: 'random', name: 'random', topic: 'Non-work banter and water cooler chat', members: TEAM },
        { key: 'activity', name: ACTIVITY_CHANNEL, topic: ACTIVITY_CHANNEL_TOPIC, members: TEAM },
        { key: 'engineering', name: 'engineering', topic: 'Frontend, backend, mobile and deployments', members: [...ENGINEERS, 'designer'], by: 'admin' },
        { key: 'design', name: 'design', topic: 'UI/UX, brand and design reviews', members: TEAM, by: 'designer' },
        { key: 'qa', name: 'qa-testing', topic: 'Bug reports, test plans and release sign-offs', members: [...ENGINEERS, 'designer'], by: 'qa' },
        { key: 'marketing', name: 'marketing', topic: 'Campaigns, content calendar and social', members: ['owner', 'pm', 'designer', 'marketing', 'sales'], by: 'marketing' },
        { key: 'sales', name: 'sales', topic: 'Pipeline, leads and client deals', type: 'PRIVATE', members: ['owner', 'admin', 'marketing', 'sales'], by: 'sales' },
        { key: 'hr', name: 'hr-people', topic: 'Leaves, holidays, hiring and people updates', members: TEAM, by: 'hr' },
        { key: 'leadership', name: 'leadership', topic: 'Strategy, hiring and financials', type: 'PRIVATE', members: ['owner', 'admin', 'hr'] },
        {
          key: 'client',
          name: 'client-collab',
          topic: 'Shared channel with our client for the website redesign',
          type: 'PRIVATE',
          members: ['owner', 'admin', 'pm', 'designer', 'sales', 'guest'],
        },
        {
          key: 'feedback',
          name: 'anonymous-feedback',
          topic: 'Share honest feedback. Your name is hidden behind a random persona',
          description: 'Anonymous channel: messages show a random persona instead of your name.',
          isAnonymous: true,
          members: TEAM,
        },
        { key: 'dm-owner-admin', name: `dm-${u.owner.id.slice(0, 4)}-${u.admin.id.slice(0, 4)}`, topic: 'Direct message', type: 'DIRECT', members: ['owner', 'admin'] },
        { key: 'dm-admin-engineer', name: `dm-${u.admin.id.slice(0, 4)}-${u.engineer.id.slice(0, 4)}`, topic: 'Direct message', type: 'DIRECT', members: ['admin', 'engineer'], by: 'admin' },
        { key: 'dm-pm-designer', name: `dm-${u.pm.id.slice(0, 4)}-${u.designer.id.slice(0, 4)}`, topic: 'Direct message', type: 'DIRECT', members: ['pm', 'designer'], by: 'pm' },
        { key: 'dm-qa-backend', name: `dm-${u.qa.id.slice(0, 4)}-${u.backend.id.slice(0, 4)}`, topic: 'Direct message', type: 'DIRECT', members: ['qa', 'backend'], by: 'qa' },
        { key: 'dm-hr-owner', name: `dm-${u.hr.id.slice(0, 4)}-${u.owner.id.slice(0, 4)}`, topic: 'Direct message', type: 'DIRECT', members: ['hr', 'owner'], by: 'hr' },
      ];

      const ch: Record<string, string> = {};
      const anon: Partial<Record<Key, { anonName: string; anonEmoji: string }>> = {};
      for (const c of CHANNELS) {
        const created = await tx.channel.create({
          data: {
            workspaceId: ws.id,
            name: c.name,
            topic: c.topic,
            description: c.description,
            type: c.type ?? 'PUBLIC',
            isAnonymous: c.isAnonymous ?? false,
            createdById: u[c.by ?? 'owner'].id,
            createdAt: at(14 * DAY),
            members: {
              create: c.members.map((k) => {
                if (!c.isAnonymous) return { userId: u[k].id };
                anon[k] = generateRandomPersona();
                return { userId: u[k].id, ...anon[k] };
              }),
            },
          },
        });
        ch[c.key] = created.id;
      }

      // ---------- Messages ----------
      const MESSAGES: Record<string, Msg[]> = {
        general: [
          {
            by: 'bot',
            ago: 3 * DAY,
            pinned: true,
            text:
              `👋 **Welcome to ${name} on Orbit!**\n\n` +
              `This demo workspace comes pre-loaded with a sample team, channels, projects and conversations so you can explore everything Orbit does.\n\n` +
              `The next few messages are a quick guided tour. Click around, post messages, create tickets. It's all yours to try. 🚀`,
          },
          {
            by: 'bot',
            ago: 3 * DAY - 1,
            text:
              `💬 **Channels & messaging**\n` +
              `- **Public channels** like #engineering and #design are open to the whole team\n` +
              `- **Private channels** like #leadership and #client-collab are invite-only 🔒\n` +
              `- **Direct messages** for 1:1 conversations, plus a personal notes space\n` +
              `- Format with **bold**, *italics*, \`inline code\`, lists and code blocks\n` +
              `- Hover any message to **react**, **reply in a thread**, **quote**, **pin**, **edit** or **delete**\n` +
              `- Use **@mentions** to notify a teammate, e.g. ${mention('admin')}`,
            reactions: [['🙌', ['admin', 'designer']]],
          },
          {
            by: 'bot',
            ago: 3 * DAY - 2,
            text: `🧵 **Threads keep channels tidy.** Reply to any message in a thread so side conversations don't flood the channel. This message has one. Open it 👇`,
            replies: [
              { by: 'designer', text: 'Threads are perfect for design feedback rounds 🎨' },
              { by: 'engineer', text: 'And for debugging sessions without spamming everyone 😄' },
            ],
          },
          {
            by: 'bot',
            ago: 3 * DAY - 3,
            text:
              `🎧 **Huddles**: start an instant audio/video call from any channel or DM. Great for quick syncs without scheduling a meeting.\n\n` +
              `🎨 **Whiteboard**: every channel has a shared, real-time whiteboard for sketching ideas together. Open **Canvases** to see 4 sample boards.\n\n` +
              `📎 **Files & search**: share files in any channel, browse them in channel storage, and search across messages.`,
          },
          {
            by: 'bot',
            ago: 3 * DAY - 4,
            text:
              `📋 **Projects & Kanban boards**: open **Projects** to find 5 sample projects: *Website Redesign*, *Mobile App v2*, *Product Launch Campaign*, *Customer Support Portal* and *Hiring Drive*. Each has:\n` +
              `- A Kanban board (Todo → In progress → In review → Done) with drag & drop\n` +
              `- Tickets with priorities, assignees, due dates, labels, checklists and comments\n` +
              `- **Docs**: a Notion-style editor for briefs, specs and plans\n` +
              `- Bot updates posted to a channel of your choice whenever tickets change`,
          },
          {
            by: 'bot',
            ago: 3 * DAY - 5,
            text:
              `🕵️ **Anonymous channels**: in #anonymous-feedback everyone posts under a random persona, so the team can share honest feedback safely.\n\n` +
              `⏱️ **Availability**: check in/out, log breaks and see who's working right now.\n\n` +
              `🤖 **Bots & integrations**: create bots, incoming webhooks and slash commands to connect Orbit with your other tools.`,
          },
          {
            by: 'bot',
            ago: 3 * DAY - 6,
            text:
              `👥 **Meet your demo team.** Each account has a different role so you can see how Orbit looks for each of them:\n` +
              PEOPLE.map((p) => `- **${p.name}** (${mention(p.key)}): ${p.role.charAt(0) + p.role.slice(1).toLowerCase()} · ${p.title}`).join('\n') +
              `\n\nLog in as any of them to experience Orbit from their point of view.`,
          },
          {
            by: 'owner',
            ago: 2 * DAY,
            text: `Morning team! ☀️ Big week ahead. The website redesign goes to the client for review on Friday. Let's keep all updates on the project board so everyone stays in sync.`,
            reactions: [['🔥', ['admin', 'designer', 'engineer']], ['👍', ['guest']]],
            replies: [
              { by: 'admin', text: "On it. I've moved the homepage tickets into *In review*." },
              { by: 'designer', text: 'Final mockups will be up in #design by Wednesday 🎨' },
            ],
          },
          {
            by: 'guest',
            ago: 2 * DAY - 30 * MIN,
            text: `Hi everyone, ${u.guest.first} here from the client side 👋 Excited to see the new designs!`,
            reactions: [['👋', ['owner', 'designer']]],
          },
          {
            by: 'admin',
            ago: 5 * HOUR,
            text: `Friendly reminder: please check in on the **Availability** page when you start your day ⏱️`,
            reactions: [['✅', ['designer', 'engineer', 'qa', 'mobile', 'hr']]],
          },
          {
            by: 'hr',
            ago: 26 * HOUR,
            text: `Please welcome ${mention('mobile')} and ${mention('qa')} who joined us this month! 🎉 Say hi 👋`,
            reactions: [['👋', ['owner', 'pm', 'designer', 'engineer', 'backend', 'sales']], ['🎉', ['admin', 'marketing']]],
            replies: [
              { by: 'mobile', text: 'Thank you all, happy to be here! 😊' },
              { by: 'qa', text: "Thanks! I'll be the one breaking your builds 😄" },
            ],
          },
          {
            by: 'pm',
            ago: 2 * HOUR,
            text: `Sprint review is at 4pm today. Please make sure your tickets on the boards are up to date 📋`,
            reactions: [['👍', ['engineer', 'backend', 'mobile', 'qa']]],
          },
          {
            by: 'owner',
            ago: 6 * DAY,
            text: `📣 **Company update**: we crossed 500 paying customers this month! Thank you all for the hard work 🙏`,
            reactions: [['🎉', ['admin', 'pm', 'designer', 'engineer', 'backend', 'mobile', 'qa', 'marketing', 'sales', 'hr']], ['🚀', ['engineer', 'backend']]],
            replies: [
              { by: 'sales', text: 'Next stop: 1,000 💪' },
              { by: 'marketing', text: 'Writing a blog post about this milestone!' },
            ],
          },
          { by: 'admin', ago: 4 * DAY, text: 'The office Wi-Fi password has changed. Ping me if you need it 📶', reactions: [['👍', ['engineer', 'qa', 'mobile']]] },
          { by: 'marketing', ago: 30 * HOUR, text: `Our case study with ${u.guest.first}'s team is live on the website 📝 Please share it on LinkedIn!`, reactions: [['🔥', ['owner', 'sales', 'designer']]] },
          { by: 'guest', ago: 22 * HOUR, text: 'Quick heads-up: our team will be offline on Monday for an internal event.', reactions: [['👍', ['owner', 'pm']]] },
          {
            by: 'owner',
            ago: 45 * MIN,
            pinned: true,
            text: `Town hall tomorrow at 11am 🗓️ ${mention('hr')} will share the new leave policy and ${mention('pm')} will demo the support portal.`,
            reactions: [['✅', ['admin', 'hr', 'pm', 'engineer']]],
          },
        ],
        random: [
          {
            by: 'engineer',
            ago: 2 * DAY - 3 * HOUR,
            text: region === 'local' ? 'Anyone up for lunch at the new biryani place? 🍛' : 'Anyone up for lunch at the new ramen place? 🍜',
            reactions: [[region === 'local' ? '🍛' : '🍜', ['designer', 'admin', 'backend', 'qa']]],
            replies: [
              { by: 'designer', text: 'Count me in!' },
              { by: 'backend', text: 'Me too, leaving at 1?' },
            ],
          },
          { by: 'designer', ago: DAY, text: 'Found a great read on building design systems that scale. Sharing in #design ☕' },
          {
            by: 'sales',
            ago: 20 * HOUR,
            text: region === 'local' ? 'Cricket match tonight 🏏 who is watching?' : 'Who is watching the game tonight? 🏈',
            reactions: [['🙋', ['owner', 'engineer', 'mobile']]],
          },
          { by: 'owner', ago: 3 * HOUR, text: 'Happy Friday everyone! 🎉 Great work this week.', reactions: [['🎉', ['admin', 'pm', 'designer', 'engineer', 'hr']]] },
          {
            by: 'mobile',
            ago: 3 * DAY,
            text: 'Who left a box of donuts in the kitchen? Asking for a friend 🍩',
            reactions: [['😂', ['qa', 'engineer', 'hr']], ['🍩', ['backend']]],
            replies: [{ by: 'hr', text: "That was me, it's someone's birthday 🎂" }],
          },
          {
            by: 'qa',
            ago: 2 * DAY,
            text: 'Recommendation thread: best podcasts for the commute? 🎧',
            replies: [
              { by: 'backend', text: 'Syntax and Software Engineering Daily' },
              { by: 'designer', text: 'Design Details is great!' },
              { by: 'marketing', text: 'How I Built This 💡' },
            ],
          },
          {
            by: 'hr',
            ago: 8 * HOUR,
            text: region === 'local' ? 'Chai break in 10 minutes ☕ Samosas are on the house today!' : 'Coffee break in 10 minutes ☕ Pastries are on the house today!',
            reactions: [['☕', ['owner', 'admin', 'pm', 'sales', 'qa']]],
          },
          { by: 'backend', ago: 90 * MIN, text: 'My cat just walked across my keyboard and pushed to staging 🐈 (just kidding… mostly)', reactions: [['😂', ['engineer', 'mobile', 'qa', 'designer']]] },
        ],
        engineering: [
          {
            by: 'engineer',
            ago: DAY + 2 * HOUR,
            text:
              `**Daily standup** 🧑‍💻\n` +
              `- ✅ Finished the auth flow for the mobile app\n` +
              `- 🔨 Working on push notifications today\n` +
              `- 🚧 Blocked: need the final API spec from ${mention('admin')}`,
            replies: [{ by: 'admin', text: `${mention('engineer')} the API spec is in the *Mobile App v2* docs now 👍` }],
          },
          {
            by: 'engineer',
            ago: DAY,
            text:
              "Quick tip, here's the retry helper we're using for flaky network calls:\n" +
              '```ts\nasync function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {\n  try {\n    return await fn();\n  } catch (err) {\n    if (attempts <= 1) throw err;\n    return withRetry(fn, attempts - 1);\n  }\n}\n```',
            reactions: [['🙌', ['admin', 'owner']]],
          },
          {
            by: 'backend',
            ago: 18 * HOUR,
            text: `Deployed the new \`/items?since=\` delta-sync endpoint to staging 🚀 ${mention('mobile')} you can start integrating offline mode.`,
            reactions: [['🚀', ['mobile', 'engineer', 'admin']]],
            replies: [{ by: 'mobile', text: 'Perfect timing, picking it up today 📱' }],
          },
          { by: 'admin', ago: 4 * HOUR, text: 'Release v2.0-beta is scheduled for next Tuesday. Please wrap up PRs by Monday EOD 🚢', pinned: true },
          {
            by: 'admin',
            ago: 3 * DAY,
            pinned: true,
            text: '**Deployment checklist** 🚢\n1. All tests green in CI\n2. QA sign-off in #qa-testing\n3. DB migrations reviewed\n4. Release notes updated\n5. Announce in #general',
          },
          { by: 'mobile', ago: 2 * DAY + 2 * HOUR, text: 'iOS build 2.0.0 (42) is on TestFlight 📲 Please install and report anything weird in #qa-testing.', reactions: [['🙌', ['qa', 'pm', 'designer']]] },
          { by: 'backend', ago: 28 * HOUR, text: 'Heads-up: database maintenance tonight at 11pm. Expect ~5 min of downtime on staging ⚠️', reactions: [['👍', ['engineer', 'mobile', 'qa']]] },
          {
            by: 'engineer',
            ago: 12 * HOUR,
            text: `PR is up for the responsive navigation 🧭 ${mention('backend')} ${mention('designer')} could you review?`,
            replies: [
              { by: 'designer', text: 'Looks great on mobile! Left 2 small comments on spacing.' },
              { by: 'backend', text: 'Approved ✅' },
            ],
          },
          { by: 'pm', ago: 2 * HOUR + 30 * MIN, text: 'Sprint velocity: 34 points (up from 28) 📈 Nice work team! Retro notes are on the *Sprint Retrospective* canvas.', reactions: [['🔥', ['engineer', 'backend', 'mobile', 'qa', 'admin']]] },
        ],
        qa: [
          {
            by: 'qa',
            ago: DAY + 4 * HOUR,
            pinned: true,
            text:
              `**Bug report template** 🐞\n` +
              `1. Steps to reproduce\n2. Expected vs actual result\n3. Device / browser\n4. Screenshot or recording\n\n` +
              `Please file every bug as a ticket on the relevant project board.`,
          },
          {
            by: 'qa',
            ago: 10 * HOUR,
            text: `Found a crash on Android 12 when opening notifications from the lock screen. ${mention('mobile')} ticket is on the *Mobile App v2* board.`,
            reactions: [['👀', ['mobile', 'pm']]],
            replies: [
              { by: 'mobile', text: 'Reproduced it, fix is in progress 🔧' },
              { by: 'qa', text: "Thanks! I'll re-test once it's on staging." },
            ],
          },
          { by: 'pm', ago: 3 * HOUR, text: 'Regression suite for v2.0-beta: 142 passed, 3 failed. Failures are tracked on the board ✅', reactions: [['💪', ['qa', 'admin']]] },
          { by: 'qa', ago: 3 * DAY, text: 'Test plan for v2.0-beta is ready. Coverage: auth, onboarding, push notifications, offline mode 📋', reactions: [['👍', ['pm', 'mobile']]] },
          {
            by: 'engineer',
            ago: 2 * DAY,
            text: `${mention('qa')} the navigation bug on Safari is fixed, can you re-test?`,
            replies: [{ by: 'qa', text: 'Verified on Safari 17, closing the ticket ✅' }],
          },
          { by: 'designer', ago: 30 * HOUR, text: 'Spotted a contrast issue on the dark-mode settings screen. Filing a ticket 🎨' },
          { by: 'qa', ago: HOUR, text: '🟢 **v2.0-beta sign-off**: all blocker and critical bugs are closed. Good to release!', reactions: [['🚀', ['admin', 'pm', 'mobile', 'backend', 'engineer']]] },
        ],
        marketing: [
          {
            by: 'marketing',
            ago: DAY + 6 * HOUR,
            text: 'Content calendar for next month is up in the *Product Launch Campaign* docs 🗓️ Blog posts go out every Tuesday and Thursday.',
            reactions: [['🔥', ['owner', 'sales']]],
          },
          {
            by: 'designer',
            ago: 15 * HOUR,
            text: `Social banners for launch week are ready for review ${mention('marketing')} 🎨`,
            replies: [{ by: 'marketing', text: 'These look great! Small tweak: can we make the CTA bigger?' }],
          },
          { by: 'sales', ago: 5 * HOUR, text: 'Leads from last week\'s webinar: 64 sign-ups, 12 booked demos 📈', reactions: [['🎉', ['marketing', 'owner', 'pm']]] },
          { by: 'marketing', ago: 3 * DAY, text: "**Last month's numbers** 📊\n- Website visits: 48k (+22%)\n- Newsletter subscribers: 3,100\n- LinkedIn followers: +540", reactions: [['📈', ['owner', 'sales']]] },
          {
            by: 'owner',
            ago: 2 * DAY,
            text: 'Can we plan a customer story video for launch week? 🎥',
            replies: [
              { by: 'marketing', text: `Yes! ${mention('sales')} can you ask ${u.guest.first} if they'd be up for it?` },
              { by: 'sales', text: "On it, I'll ask on our next call 📞" },
            ],
          },
          { by: 'pm', ago: 9 * HOUR, text: 'Launch date confirmed for the 15th 🗓️ Ideas from the brainstorm are on the *Launch Campaign Brainstorm* canvas.' },
          { by: 'marketing', ago: 50 * MIN, text: 'Draft of the launch email is ready for review ✉️ Feedback by EOD please!', reactions: [['👀', ['designer', 'owner']]] },
        ],
        sales: [
          { by: 'sales', ago: DAY + 2 * HOUR, text: `Closed the annual deal with ${u.guest.first}'s team 🤝 Contract signed this morning!`, reactions: [['🎉', ['owner', 'admin', 'marketing']]] },
          { by: 'owner', ago: DAY + HOUR, text: 'Amazing work! What does the pipeline look like for this quarter?' },
          { by: 'sales', ago: DAY, text: '**Q-pipeline**\n- 8 qualified leads\n- 4 proposals sent\n- 2 in negotiation\n\nTarget is on track 📊' },
          { by: 'marketing', ago: 2 * DAY, text: 'Sharing 15 new inbound leads from the website form. Added them to the CRM 📥' },
          { by: 'admin', ago: 20 * HOUR, text: 'Reminder: all discounts above 15% need approval from leadership.' },
          {
            by: 'sales',
            ago: 10 * HOUR,
            text: 'Demo with a new prospect went really well 🎯 They want a proposal by Friday.',
            reactions: [['🔥', ['owner', 'marketing']]],
            replies: [{ by: 'owner', text: 'Great! Loop me in on pricing.' }],
          },
          { by: 'sales', ago: 2 * HOUR, text: 'Monthly target: 82% achieved with a week to go 💪', reactions: [['💪', ['owner', 'admin', 'marketing']]] },
        ],
        hr: [
          {
            by: 'hr',
            ago: 2 * DAY + HOUR,
            pinned: true,
            text:
              region === 'local'
                ? '📅 **Upcoming holidays**: office will be closed for Eid. Please submit your leave requests before the end of this week.'
                : '📅 **Upcoming holidays**: office will be closed for the holiday break. Please submit your leave requests before the end of this week.',
            reactions: [['🙏', ['engineer', 'designer', 'backend', 'qa', 'sales']]],
          },
          { by: 'hr', ago: DAY, text: 'Reminder: performance self-reviews are due next Friday. The template is in your inbox ✍️' },
          {
            by: 'hr',
            ago: 6 * HOUR,
            text: `We're hiring! 🎯 Open roles: Senior Backend Engineer and Content Writer. Referrals welcome, details on the *Hiring Drive* board.`,
            reactions: [['🙌', ['owner', 'backend', 'marketing']]],
          },
          { by: 'hr', ago: 4 * DAY, text: 'Health insurance cards are ready. Please collect yours from the front desk 🏥', reactions: [['🙏', ['engineer', 'qa', 'mobile']]] },
          {
            by: 'engineer',
            ago: 3 * DAY,
            text: 'Is the work-from-home policy still 2 days a week?',
            replies: [{ by: 'hr', text: 'Yes, 2 days a week. Just mark it on the Availability page 🏡' }],
          },
          {
            by: 'hr',
            ago: 3 * HOUR,
            text: `Birthday shout-out 🎂 Happy birthday ${mention('designer')}! Cake in the kitchen at 4pm`,
            reactions: [['🎂', ['owner', 'admin', 'pm', 'engineer', 'backend', 'mobile', 'qa', 'marketing', 'sales']]],
            replies: [{ by: 'designer', text: 'Thank you everyone 🥹' }],
          },
        ],
        design: [
          {
            by: 'designer',
            ago: DAY + 5 * HOUR,
            text: 'New homepage hero explorations are ready for feedback 🎨 Option B is my favourite: cleaner layout and much better contrast.',
            reactions: [['😍', ['owner']], ['👍', ['admin', 'engineer']]],
            replies: [
              { by: 'owner', text: 'B for sure. Love the typography 😍' },
              { by: 'admin', text: "Agreed, let's go with B and share it with the client." },
            ],
          },
          { by: 'designer', ago: 6 * HOUR, text: 'Updated the brand colour palette in the *Website Redesign* project brief 🖌️' },
          {
            by: 'designer',
            ago: 3 * DAY,
            pinned: true,
            text: '**Design system v2** is live in Figma 🎨\n- New colour tokens\n- 24 updated components\n- Dark mode for every screen',
            reactions: [['😍', ['engineer', 'mobile', 'pm']]],
          },
          {
            by: 'pm',
            ago: 2 * DAY,
            text: 'Homepage layout is sketched on the *Homepage Wireframe* canvas. Can we turn it into hi-fi mockups by Thursday?',
            replies: [{ by: 'designer', text: 'Yes, starting today ✏️' }],
          },
          {
            by: 'mobile',
            ago: 20 * HOUR,
            text: 'Small request: can we export the new icons as SVG? 🙏',
            replies: [{ by: 'designer', text: 'Done, they are in the shared folder 📁' }],
          },
          { by: 'marketing', ago: 4 * HOUR, text: 'Love the new illustrations for the launch page! 💜', reactions: [['💜', ['designer']]] },
        ],
        leadership: [
          { by: 'owner', ago: DAY + 3 * HOUR, text: "Q3 numbers look strong 📈 Revenue is up 18% QoQ. Let's discuss hiring plans on Thursday." },
          { by: 'admin', ago: DAY + 2 * HOUR, text: "Sounds good. I'll prep the headcount proposal for engineering and design." },
          { by: 'hr', ago: 2 * DAY, text: 'Attrition this quarter is at 3%, the lowest in two years 📉' },
          { by: 'owner', ago: 20 * HOUR, text: 'Approved budget for 2 new hires and a team offsite next month 🏕️', reactions: [['🎉', ['admin', 'hr']]] },
          { by: 'admin', ago: 6 * HOUR, text: 'Draft of next quarter OKRs is ready. Sharing it in the meeting tomorrow.' },
        ],
        client: [
          {
            by: 'owner',
            ago: 2 * DAY - HOUR,
            text: `Welcome to our shared channel, ${mention('guest')} 👋 This is where we'll share progress and collect your feedback on the website redesign.`,
          },
          { by: 'guest', ago: 2 * DAY - 50 * MIN, text: 'Thanks! The new homepage direction looks fantastic. Could we see a mobile version before Friday?' },
          { by: 'designer', ago: 2 * DAY - 40 * MIN, text: "Absolutely, I'll share mobile mockups here by Thursday 📱", reactions: [['🙏', ['guest']]] },
          { by: 'designer', ago: DAY + 3 * HOUR, text: 'Mobile mockups are ready 📱 Homepage, pricing and contact pages are in the project docs.', reactions: [['😍', ['guest']]] },
          {
            by: 'guest',
            ago: DAY + 2 * HOUR,
            text: 'These look great! One request: can we make the contact form shorter?',
            replies: [{ by: 'pm', text: "Good call, we'll cut it down to 3 fields." }],
          },
          { by: 'pm', ago: 7 * HOUR, text: '**Weekly status** 📋\n- Homepage: in review\n- Navigation: in progress\n- Pricing page: in design\n\nOn track for the Friday review ✅' },
          { by: 'guest', ago: HOUR, text: 'Thanks for the update, see you all on Friday 👋', reactions: [['👋', ['owner', 'pm', 'sales']]] },
        ],
        feedback: [
          { by: 'designer', ago: 2 * DAY, text: 'It would be great to have no-meeting Wednesdays so we can focus on deep work 🙏' },
          { by: 'engineer', ago: DAY + HOUR, text: 'Really appreciate how quickly leadership acted on last month\'s feedback. Thank you!' },
          { by: 'admin', ago: 7 * HOUR, text: 'Could we get a clearer process for prioritising bug reports?' },
          { by: 'qa', ago: 30 * HOUR, text: 'Could we have a shared calendar for release dates? Hard to track them right now.' },
          { by: 'mobile', ago: 12 * HOUR, text: 'The onboarding buddy programme made my first week so much easier 💙' },
          { by: 'sales', ago: 3 * HOUR, text: 'More cross-team demos would help sales understand new features better 🙏' },
        ],
        'dm-owner-admin': [
          { by: 'owner', ago: 5 * HOUR, text: `Hey ${u.admin.first}, can you send me the updated project timeline before the client call?` },
          { by: 'admin', ago: 5 * HOUR - 5, text: "Sure, I'll share it in 10 min 👍" },
          { by: 'owner', ago: 4 * HOUR, text: 'Got it, thanks! Can we also review the hiring budget tomorrow?' },
          { by: 'admin', ago: 4 * HOUR - 3, text: 'Sure, 10am works 👍' },
        ],
        'dm-admin-engineer': [
          { by: 'admin', ago: 9 * HOUR, text: `Great job on the auth flow, ${u.engineer.first}! 🙌` },
          { by: 'engineer', ago: 9 * HOUR - 3, text: 'Thanks! Push notifications are next.' },
          { by: 'engineer', ago: 3 * HOUR, text: 'Can I take Friday off? The navigation work will be done by Thursday.' },
          { by: 'admin', ago: 3 * HOUR - 5, text: 'Of course, enjoy the long weekend 🌴' },
        ],
        'dm-pm-designer': [
          { by: 'pm', ago: 7 * HOUR, text: `${u.designer.first}, can we move the pricing page review to tomorrow morning?` },
          { by: 'designer', ago: 7 * HOUR - 4, text: 'Sure, 11am works for me ☕' },
          { by: 'pm', ago: 6 * HOUR, text: 'Also, the client loved the mobile mockups 🎉' },
          { by: 'designer', ago: 6 * HOUR - 2, text: 'Yay! That made my day 😊' },
        ],
        'dm-qa-backend': [
          { by: 'qa', ago: 4 * HOUR, text: 'The `/devices` endpoint returns 500 when the token is empty. Can you take a look?' },
          { by: 'backend', ago: 4 * HOUR - 10, text: 'Good catch! Added validation, fix is on staging now ✅' },
          { by: 'qa', ago: 4 * HOUR - 20, text: 'Verified, thanks 🙏' },
          { by: 'backend', ago: 2 * HOUR, text: 'Pushed the rate limiting change too. Could you add it to the regression suite?' },
          { by: 'qa', ago: 2 * HOUR - 8, text: 'Added ✅ Will run it tonight.' },
        ],
        'dm-hr-owner': [
          { by: 'hr', ago: 8 * HOUR, text: 'Shortlisted 5 candidates for the Senior Backend role. Interviews start Monday.' },
          { by: 'owner', ago: 8 * HOUR - 6, text: `Great, please loop in ${u.backend.first} for the technical round 👍` },
          { by: 'hr', ago: 2 * HOUR, text: 'The offer letter for the Content Writer is ready for your signature ✍️' },
          { by: 'owner', ago: 2 * HOUR - 4, text: 'Signed, please send it out 👍' },
        ],
        activity: [
          { by: 'bot', ago: 14 * DAY, text: `📢 **${u.admin.displayName}** created #engineering` },
          { by: 'bot', ago: 14 * DAY - 10, text: `📢 **${u.designer.displayName}** created #design` },
          { by: 'bot', ago: 14 * DAY - 20, text: `📢 **${u.qa.displayName}** created #qa-testing` },
          { by: 'bot', ago: 14 * DAY - 30, text: `📢 **${u.marketing.displayName}** created #marketing` },
          { by: 'bot', ago: 14 * DAY - 40, text: `📢 **${u.hr.displayName}** created #hr-people` },
          { by: 'bot', ago: 2 * DAY - 5, text: `🔥 **${u.admin.displayName}** reacted to a message in #general` },
          { by: 'bot', ago: 14 * DAY - 50, text: `📢 **${u.sales.displayName}** created #sales` },
          { by: 'bot', ago: DAY - 10, text: `📌 **${u.qa.displayName}** pinned a message in #qa-testing` },
        ],
      };

      const reactions: { messageId: string; userId: string; emoji: string }[] = [];
      const messageData = (channelKey: string, by: Key | 'bot', content: string, ago: number) => ({
        channelId: ch[channelKey],
        content,
        createdAt: at(ago),
        ...(by === 'bot' ? { botAppId: bot.id } : { userId: u[by].id, ...(channelKey === 'feedback' ? anon[by] : {}) }),
      });

      for (const [channelKey, list] of Object.entries(MESSAGES)) {
        for (const m of list) {
          const parent = await tx.message.create({
            data: { ...messageData(channelKey, m.by, m.text, m.ago), isPinned: m.pinned ?? false },
          });
          for (const [i, r] of (m.replies ?? []).entries()) {
            await tx.message.create({
              data: { ...messageData(channelKey, r.by, r.text, m.ago - (i + 1) * 4), parentMessageId: parent.id },
            });
          }
          for (const [emoji, who] of m.reactions ?? []) {
            for (const k of who) reactions.push({ messageId: parent.id, userId: u[k].id, emoji });
          }
        }
      }
      await tx.reaction.createMany({ data: reactions });

      // ---------- Projects ----------
      const PROJECTS: {
        name: string;
        icon: string;
        color: string;
        description: string;
        channel: string;
        managers: Key[];
        team: Key[];
        withClient?: boolean;
        doc: { title: string; icon: string; content: string };
        tickets: TicketSpec[];
      }[] = [
        {
          name: 'Website Redesign',
          icon: '🎨',
          color: '#8B5CF6',
          description: 'Complete redesign of the marketing website with a new brand identity, faster performance and better conversion.',
          channel: 'design',
          managers: ['admin', 'pm'],
          team: ['designer', 'engineer', 'qa'],
          withClient: true,
          doc: {
            title: 'Project Brief',
            icon: '📝',
            content: [
              '# Website Redesign: Project Brief',
              '> 💡 Goal: launch a faster, on-brand website that doubles demo sign-ups.',
              '## Objectives',
              '- Refresh the visual identity and brand colour palette',
              '- Improve Lighthouse performance score to 90+',
              '- Increase demo sign-up conversion from 2% to 4%',
              '## Timeline',
              '| Phase | Owner | Target |',
              '| --- | --- | --- |',
              `| Discovery & kickoff | ${u.admin.displayName} | Week 1 |`,
              `| Design | ${u.designer.displayName} | Weeks 2–3 |`,
              `| Build | ${u.engineer.displayName} | Weeks 3–5 |`,
              '| Client review & launch | Everyone | Week 6 |',
              '## Launch checklist',
              '- [x] Kickoff meeting with client',
              '- [x] Brand colour palette approved',
              '- [ ] Homepage signed off',
              '- [ ] Analytics in place',
            ].join('\n'),
          },
          tickets: [
            { col: 0, title: 'Write copy for the About page', priority: 'MEDIUM', who: 'admin', labels: ['Content'], due: 6, points: 2 },
            { col: 0, title: 'Set up analytics & conversion tracking', priority: 'LOW', who: 'engineer', labels: ['Dev'], due: 10, points: 3 },
            {
              col: 1,
              title: 'Build responsive navigation',
              priority: 'HIGH',
              who: 'engineer',
              labels: ['Dev', 'Frontend'],
              due: 3,
              points: 5,
              desc: 'Sticky header with mega-menu on desktop and a slide-in drawer on mobile.',
              checklist: [['Desktop mega-menu', true], ['Mobile drawer', false], ['Keyboard accessibility', false]],
            },
            { col: 1, title: 'Design pricing page', priority: 'MEDIUM', who: 'designer', labels: ['Design'], due: 4, points: 3 },
            {
              col: 2,
              title: 'Homepage hero section',
              priority: 'HIGH',
              who: 'designer',
              labels: ['Design'],
              due: 1,
              points: 5,
              desc: 'New hero with product screenshot, headline A/B variants and a primary CTA.',
              comments: [
                ['owner', 'Looks amazing. Can we try a darker background variant?'],
                ['designer', 'Done! Added variant B to the design file 🎨'],
              ],
            },
            { col: 2, title: 'Cross-browser QA pass', priority: 'MEDIUM', who: 'qa', labels: ['QA'], due: 2, points: 3, checklist: [['Chrome', true], ['Safari', true], ['Firefox', false], ['Edge', false]] },
            { col: 3, title: 'Finalize brand colour palette', priority: 'MEDIUM', who: 'designer', labels: ['Design'], due: -3, points: 2 },
            { col: 3, title: 'Kickoff meeting with client', priority: 'LOW', who: 'pm', labels: ['Planning'], due: -7, points: 1 },
            { col: 0, title: 'Contact form with spam protection', priority: 'MEDIUM', who: 'engineer', labels: ['Dev', 'Frontend'], due: 8, points: 3 },
            { col: 0, title: 'SEO meta tags & sitemap', priority: 'LOW', who: 'pm', labels: ['SEO', 'Content'], due: 12, points: 2 },
            { col: 1, title: 'Blog page template', priority: 'MEDIUM', who: 'designer', labels: ['Design'], due: 5, points: 3 },
            {
              col: 1,
              title: 'Image optimisation & lazy loading',
              priority: 'HIGH',
              who: 'engineer',
              labels: ['Dev', 'Performance'],
              due: 4,
              points: 3,
              checklist: [['Convert to WebP', true], ['Lazy load below the fold', false], ['Lighthouse 90+', false]],
            },
            { col: 3, title: 'Competitor website audit', priority: 'LOW', who: 'pm', labels: ['Research'], due: -9, points: 2 },
          ],
        },
        {
          name: 'Mobile App v2',
          icon: '📱',
          color: '#3B82F6',
          description: 'Next major release of our iOS & Android app: new onboarding, offline mode and push notifications.',
          channel: 'engineering',
          managers: ['admin', 'pm'],
          team: ['mobile', 'backend', 'qa', 'designer'],
          doc: {
            title: 'API Specification',
            icon: '🔌',
            content: [
              '# Mobile App v2: API Specification',
              '> ℹ️ All endpoints require a Bearer token in the Authorization header.',
              '## Endpoints',
              '| Method | Path | Description |',
              '| --- | --- | --- |',
              '| POST | /auth/login | Email & password login |',
              '| GET | /me | Current user profile |',
              '| POST | /devices | Register a push notification token |',
              '| GET | /items?since= | Delta sync for offline mode |',
              '## Example',
              '```json',
              '{ "token": "fcm-token", "platform": "ios" }',
              '```',
            ].join('\n'),
          },
          tickets: [
            { col: 0, title: 'Offline mode for saved items', priority: 'HIGH', who: 'mobile', labels: ['Dev', 'Mobile'], due: 14, points: 8 },
            { col: 0, title: 'App Store screenshots & listing', priority: 'LOW', who: 'designer', labels: ['Design'], due: 12, points: 2 },
            {
              col: 0,
              title: 'Crash when opening notification from lock screen (Android 12)',
              priority: 'HIGH',
              who: 'mobile',
              labels: ['Bug', 'Mobile'],
              due: 1,
              points: 3,
              desc: 'Steps: lock device → receive push → tap notification → app crashes on launch.',
              comments: [['qa', 'Happens 100% of the time on Pixel 5, Android 12.']],
            },
            { col: 1, title: 'Delta-sync API endpoint', priority: 'HIGH', who: 'backend', labels: ['Dev', 'Backend'], due: 3, points: 5 },
            {
              col: 1,
              title: 'Push notifications',
              priority: 'URGENT',
              who: 'mobile',
              labels: ['Dev', 'Mobile'],
              due: 2,
              points: 5,
              checklist: [['FCM setup', true], ['iOS APNs certificates', true], ['Notification preferences screen', false], ['QA on real devices', false]],
              comments: [['admin', 'Any blockers here? This is needed for the beta.']],
            },
            {
              col: 2,
              title: 'New onboarding flow',
              priority: 'HIGH',
              who: 'designer',
              labels: ['Design', 'UX'],
              due: 2,
              points: 5,
              comments: [['mobile', 'Implemented the first 3 screens, ready for review 👀']],
            },
            { col: 2, title: 'Regression test suite for v2.0-beta', priority: 'MEDIUM', who: 'qa', labels: ['QA'], due: 4, points: 3 },
            { col: 3, title: 'Email & password authentication', priority: 'HIGH', who: 'backend', labels: ['Dev', 'Backend'], due: -2, points: 5 },
            { col: 3, title: 'Crash reporting setup', priority: 'MEDIUM', who: 'mobile', labels: ['Dev'], due: -5, points: 2 },
            { col: 0, title: 'Dark mode support', priority: 'MEDIUM', who: 'mobile', labels: ['Mobile', 'Design'], due: 16, points: 5 },
            { col: 0, title: 'Rate limiting on public API', priority: 'MEDIUM', who: 'backend', labels: ['Backend', 'Security'], due: 9, points: 3 },
            { col: 1, title: 'In-app feedback form', priority: 'LOW', who: 'mobile', labels: ['Mobile'], due: 7, points: 2 },
            {
              col: 2,
              title: 'Fix contrast on dark-mode settings screen',
              priority: 'MEDIUM',
              who: 'designer',
              labels: ['Bug', 'Design'],
              due: 2,
              points: 1,
              comments: [['qa', 'Fails WCAG AA on the subtitle text.']],
            },
            { col: 3, title: 'CI pipeline for iOS & Android', priority: 'HIGH', who: 'backend', labels: ['DevOps'], due: -8, points: 5 },
          ],
        },
        {
          name: 'Product Launch Campaign',
          icon: '🚀',
          color: '#F59E0B',
          description: 'Go-to-market campaign for the Q4 product launch: landing page, email sequence, social and press.',
          channel: 'marketing',
          managers: ['owner', 'marketing'],
          team: ['designer', 'sales'],
          doc: {
            title: 'Launch Plan',
            icon: '🗓️',
            content: [
              '# Product Launch Plan',
              '> 🚀 Launch date: end of this quarter',
              '## Channels',
              '- Landing page & product demo video',
              '- 5-email nurture sequence',
              '- Social media (LinkedIn, X, Instagram)',
              '- Press release & partner announcements',
              '## Success metrics',
              '| Metric | Target |',
              '| --- | --- |',
              '| Launch-week sign-ups | 1,000 |',
              '| Email open rate | 45% |',
              '| Press mentions | 5 |',
            ].join('\n'),
          },
          tickets: [
            { col: 0, title: 'Press release draft', priority: 'MEDIUM', who: 'marketing', labels: ['Marketing'], due: 9, points: 3 },
            { col: 0, title: 'Launch day social posts', priority: 'LOW', who: 'designer', labels: ['Marketing', 'Design'], due: 11, points: 2 },
            { col: 1, title: 'Email nurture sequence (5 emails)', priority: 'HIGH', who: 'marketing', labels: ['Marketing'], due: 5, points: 5 },
            { col: 1, title: 'Sales deck & one-pager', priority: 'MEDIUM', who: 'sales', labels: ['Sales'], due: 6, points: 3 },
            { col: 2, title: 'Launch landing page', priority: 'URGENT', who: 'designer', labels: ['Design'], due: 1, points: 5 },
            { col: 3, title: 'Define target audience & messaging', priority: 'MEDIUM', who: 'owner', labels: ['Strategy'], due: -6, points: 3 },
            { col: 3, title: 'Webinar: product preview', priority: 'MEDIUM', who: 'sales', labels: ['Sales', 'Marketing'], due: -4, points: 3 },
            { col: 0, title: 'Customer story video', priority: 'MEDIUM', who: 'marketing', labels: ['Marketing', 'Video'], due: 14, points: 5 },
            { col: 0, title: 'Partner announcement outreach', priority: 'LOW', who: 'sales', labels: ['Sales'], due: 10, points: 2 },
            { col: 1, title: 'Launch blog post', priority: 'MEDIUM', who: 'marketing', labels: ['Content'], due: 6, points: 2 },
            {
              col: 2,
              title: 'Pricing page copy update',
              priority: 'HIGH',
              who: 'marketing',
              labels: ['Content'],
              due: 2,
              points: 2,
              comments: [['owner', 'Make the annual discount more visible please.']],
            },
            { col: 3, title: 'Brand assets kit for partners', priority: 'LOW', who: 'designer', labels: ['Design'], due: -3, points: 2 },
          ],
        },
        {
          name: 'Customer Support Portal',
          icon: '🎧',
          color: '#10B981',
          description: 'Self-service help centre with a knowledge base, ticket submission and live chat for customers.',
          channel: 'engineering',
          managers: ['pm'],
          team: ['backend', 'engineer', 'qa'],
          doc: {
            title: 'Requirements',
            icon: '📋',
            content: [
              '# Customer Support Portal: Requirements',
              '> 🎯 Goal: cut support email volume by 40% with self-service.',
              '## Must have',
              '- Searchable knowledge base',
              '- Ticket submission with file attachments',
              '- Email notifications on ticket updates',
              '## Nice to have',
              '- Live chat widget',
              '- CSAT survey after a ticket is closed',
            ].join('\n'),
          },
          tickets: [
            { col: 0, title: 'Live chat widget', priority: 'LOW', who: 'engineer', labels: ['Dev', 'Frontend'], due: 20, points: 8 },
            { col: 0, title: 'CSAT survey after ticket close', priority: 'LOW', who: 'backend', labels: ['Dev'], due: 18, points: 3 },
            { col: 1, title: 'Knowledge base search', priority: 'HIGH', who: 'backend', labels: ['Dev', 'Backend'], due: 5, points: 5, checklist: [['Full-text index', true], ['Search API', false], ['Result ranking', false]] },
            { col: 1, title: 'Ticket submission form', priority: 'MEDIUM', who: 'engineer', labels: ['Dev', 'Frontend'], due: 6, points: 3 },
            { col: 2, title: 'Test plan for support portal', priority: 'MEDIUM', who: 'qa', labels: ['QA'], due: 3, points: 2 },
            { col: 3, title: 'Portal requirements sign-off', priority: 'MEDIUM', who: 'pm', labels: ['Planning'], due: -4, points: 1 },
            { col: 0, title: 'Email notifications on ticket updates', priority: 'MEDIUM', who: 'backend', labels: ['Dev', 'Backend'], due: 10, points: 3 },
            { col: 0, title: 'Write 20 help centre articles', priority: 'MEDIUM', who: 'pm', labels: ['Content'], due: 15, points: 5 },
            { col: 1, title: 'Portal UI layout', priority: 'HIGH', who: 'engineer', labels: ['Dev', 'Frontend'], due: 4, points: 5 },
            { col: 2, title: 'File attachment upload', priority: 'MEDIUM', who: 'backend', labels: ['Dev'], due: 3, points: 3 },
            { col: 3, title: 'Tech stack decision', priority: 'LOW', who: 'backend', labels: ['Planning'], due: -6, points: 1 },
          ],
        },
        {
          name: 'Hiring Drive',
          icon: '🎯',
          color: '#EC4899',
          description: 'Hiring pipeline for this quarter: Senior Backend Engineer and Content Writer.',
          channel: 'hr',
          managers: ['hr'],
          team: ['owner', 'backend', 'marketing'],
          doc: {
            title: 'Interview Process',
            icon: '🧑‍💼',
            content: [
              '# Interview Process',
              '| Stage | Owner | Duration |',
              '| --- | --- | --- |',
              `| Screening call | ${u.hr.displayName} | 30 min |`,
              `| Technical round | ${u.backend.displayName} | 60 min |`,
              `| Culture fit | ${u.owner.displayName} | 45 min |`,
              '## Scorecard',
              '- Problem solving',
              '- Communication',
              '- Ownership',
            ].join('\n'),
          },
          tickets: [
            { col: 0, title: 'Post Content Writer job ad', priority: 'MEDIUM', who: 'hr', labels: ['Hiring'], due: 3, points: 1 },
            { col: 1, title: 'Screen Senior Backend applicants', priority: 'HIGH', who: 'hr', labels: ['Hiring'], due: 2, points: 3 },
            { col: 1, title: 'Prepare technical take-home task', priority: 'MEDIUM', who: 'backend', labels: ['Hiring', 'Dev'], due: 4, points: 2 },
            { col: 2, title: 'Review writing samples', priority: 'MEDIUM', who: 'marketing', labels: ['Hiring'], due: 5, points: 2 },
            { col: 3, title: 'Approve hiring budget', priority: 'HIGH', who: 'owner', labels: ['Hiring'], due: -5, points: 1 },
            { col: 0, title: 'Plan onboarding week for new hires', priority: 'MEDIUM', who: 'hr', labels: ['Onboarding'], due: 12, points: 2 },
            { col: 0, title: 'Update careers page', priority: 'LOW', who: 'marketing', labels: ['Hiring', 'Content'], due: 8, points: 1 },
            {
              col: 1,
              title: 'Technical interviews (round 1)',
              priority: 'HIGH',
              who: 'backend',
              labels: ['Hiring'],
              due: 3,
              points: 3,
              checklist: [['Candidate A', true], ['Candidate B', true], ['Candidate C', false], ['Candidate D', false], ['Candidate E', false]],
            },
            { col: 2, title: 'Offer letter: Content Writer', priority: 'HIGH', who: 'owner', labels: ['Hiring'], due: 1, points: 1 },
            { col: 3, title: 'Define role scorecards', priority: 'MEDIUM', who: 'hr', labels: ['Hiring'], due: -7, points: 2 },
          ],
        },
      ];

      const ref = (k: Key) => ({ uid: u[k].id, name: u[k].displayName });
      const notifications: { userId: string; workspaceId: string; type: 'SYSTEM'; title: string; body: string; createdAt: Date }[] = [];

      const projectIds: Record<string, string> = {};
      for (const [pi, p] of PROJECTS.entries()) {
        const project = await tx.project.create({
          data: {
            workspaceId: ws.id,
            name: p.name,
            description: p.description,
            icon: p.icon,
            color: p.color,
            status: 'active',
            notificationChannelId: ch[p.channel],
            createdById: u.owner.id,
            createdAt: at(10 * DAY - pi * HOUR),
            selectedManagers: p.managers.map(ref),
            assignedEmployees: p.team.map(ref),
            ...(p.withClient && {
              clientUid: u.guest.id,
              clientUsername: u.guest.username,
              clientEmail: `guest@${domain}`,
            }),
            columns: { create: COLUMNS },
            ticketCounter: p.tickets.length,
          },
          include: { columns: { orderBy: { orderIndex: 'asc' } } },
        });
        projectIds[p.name] = project.id;

        const creator = u[p.managers[0]];
        const order = [0, 0, 0, 0];
        for (const [ti, t] of p.tickets.entries()) {
          const createdAt = at(8 * DAY - ti * 2 * HOUR);
          const assignee = u[t.who];
          const events = [
            { id: `evt-${createdAt.getTime()}-0`, type: 'created', action: `Created to ${COLUMNS[0].name}`, user: creator.displayName, date: createdAt.toISOString(), color: '#3B82F6' },
            ...COLUMNS.slice(1, t.col + 1).map((c, i) => {
              const date = new Date(createdAt.getTime() + (i + 1) * DAY);
              return { id: `evt-${date.getTime()}-${i + 1}`, type: 'status_change', action: `Status Change from ${COLUMNS[i].name} to ${c.name}`, user: assignee.displayName, date: date.toISOString(), color: '#10B981' };
            }),
          ];

          const ticket = await tx.ticket.create({
            data: {
              projectId: project.id,
              columnId: project.columns[t.col].id,
              issueNumber: ti + 1,
              title: t.title,
              description: t.desc,
              priority: t.priority,
              orderIndex: order[t.col]++,
              dueDate: new Date(Date.now() + t.due * DAY * 60_000),
              createdById: creator.id,
              assigneeId: assignee.id,
              assignees: [ref(t.who)],
              labels: t.labels,
              storyPoints: t.points,
              checklist: t.checklist?.map(([text, completed], i) => ({ id: `chk-${ti}-${i}`, text, completed })),
              events,
              createdAt,
            },
          });

          if (t.comments) {
            await tx.ticketComment.createMany({
              data: t.comments.map(([k, text], i) => ({
                ticketId: ticket.id,
                userId: u[k].id,
                username: u[k].displayName,
                text,
                createdAt: at(DAY - i * HOUR),
              })),
            });
          }

          if (t.col < 3 && assignee.id !== creator.id) {
            notifications.push({
              userId: assignee.id,
              workspaceId: ws.id,
              type: 'SYSTEM',
              title: `Project: ${p.name}`,
              body: `${creator.displayName} assigned you "${t.title}"`,
              createdAt,
            });
          }

          // What the board's bot would have posted when the ticket moved to review.
          if (t.col === 2) {
            await tx.message.create({
              data: messageData(p.channel, 'bot', `🤖 **Orbit Bot** 📋 *${p.name}* • ${assignee.displayName} moved **"${t.title}"** to ${COLUMNS[2].name}`, 20 * HOUR - pi * HOUR),
            });
          }
        }

        await tx.projectDocument.create({
          data: {
            projectId: project.id,
            workspaceId: ws.id,
            title: p.doc.title,
            icon: p.doc.icon,
            content: p.doc.content,
            isPublicInProject: true,
            createdById: creator.id,
          },
        });
      }

      await tx.notification.createMany({ data: notifications });

      // ---------- Canvases (whiteboards linked to a channel or a project) ----------
      await tx.canvas.createMany({
        data: DEMO_CANVASES.map((c, i) => ({
          workspaceId: ws.id,
          title: c.title,
          channelId: c.channel ? ch[c.channel] : null,
          projectId: c.project ? projectIds[c.project] : null,
          createdById: u[c.by].id,
          data: { elements: c.elements },
          createdAt: at(5 * DAY - i * HOUR),
        })),
      });

      // ---------- Availability history (last 5 weekdays) ----------
      const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' });
      const days: Date[] = [];
      for (let d = 1; days.length < 5; d++) {
        const date = new Date(Date.now() - d * DAY * 60_000);
        if (date.getDay() !== 0 && date.getDay() !== 6) days.push(date);
      }
      for (const [ui, k] of TEAM.entries()) {
        for (const day of days) {
          const start = new Date(new Date(`${dayFmt.format(day)}T09:00:00+05:00`).getTime() + ui * 7 * 60_000);
          const lunch = new Date(start.getTime() + 4 * HOUR * 60_000);
          const back = new Date(lunch.getTime() + 45 * 60_000);
          await tx.userAvailability.create({
            data: {
              userId: u[k].id,
              date: dayFmt.format(day),
              availableTime: start,
              offTime: new Date(start.getTime() + 8.5 * HOUR * 60_000),
              totalWorkingMinutes: 8.5 * HOUR - 45,
              isAvailable: false,
              breaks: {
                create: { breakReason: 'Lunch', breakStartTime: lunch, availableAfterBreak: back, breakDurationMinutes: 45 },
              },
            },
          });
        }
      }

      return ws;
    },
    { timeout: 60_000, maxWait: 10_000 },
  );

  return {
    workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
    password,
    accounts: PEOPLE.map((p) => ({ name: p.name, role: p.role, title: p.title, email: `${p.key}@${domain}` })),
  };
}
