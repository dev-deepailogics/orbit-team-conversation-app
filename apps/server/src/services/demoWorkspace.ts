import { prisma } from '@orbit/db';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { ACTIVITY_CHANNEL, ACTIVITY_CHANNEL_TOPIC } from './systemBot.js';
import { generateRandomPersona } from './anonymousService.js';

// Demo accounts live at <key>@<slug>.demo, so the email alone tells which demo workspace a user belongs to.
export const demoEmailDomain = (slug: string) => `${slug}.demo`;

export const isDemoEmail = (email: string) => email.toLowerCase().endsWith('.demo');

// True when a demo user would be leaking into a workspace other than their own.
export function isForeignDemoUser(email: string, workspaceSlug: string) {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return isDemoEmail(domain) && domain !== demoEmailDomain(workspaceSlug);
}

type Key = 'owner' | 'admin' | 'designer' | 'engineer' | 'guest';
type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';

const PEOPLE: { key: Key; role: Role; name: string; title: string; status?: [string, string] }[] = [
  { key: 'owner', role: 'OWNER', name: 'Olivia Bennett', title: 'CEO & Founder' },
  { key: 'admin', role: 'ADMIN', name: 'Marcus Reid', title: 'Head of Operations' },
  { key: 'designer', role: 'MEMBER', name: 'Priya Shah', title: 'Product Designer', status: ['Designing in Figma', '🎨'] },
  { key: 'engineer', role: 'MEMBER', name: 'Daniel Kim', title: 'Software Engineer', status: ['Deep work', '🎧'] },
  { key: 'guest', role: 'GUEST', name: 'Alex Morgan', title: 'Client (external guest)' },
];

const TEAM: Key[] = ['owner', 'admin', 'designer', 'engineer'];
const EVERYONE: Key[] = [...TEAM, 'guest'];

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

export async function createDemoWorkspace(name: string) {
  const slug = await pickSlug(name);
  const password = `Demo-${randomBytes(4).toString('hex')}`;
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
            avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`,
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
          iconUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${slug}`,
          ownerId: u.owner.id,
          settings: { isDemo: true },
          members: { create: PEOPLE.map((p) => ({ userId: u[p.key].id, role: p.role })) },
        },
      });

      // Same name as getOrCreateSystemBot() so later bot notifications reuse it.
      const bot = await tx.botApp.create({
        data: {
          workspaceId: ws.id,
          name: 'Orbit Bot',
          description: 'Default Orbit system notifications and activity alerts',
          avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=OrbitSystemBot&backgroundColor=007a5a',
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
        { key: 'engineering', name: 'engineering', topic: 'Frontend, backend, mobile and deployments', members: TEAM, by: 'admin' },
        { key: 'design', name: 'design', topic: 'UI/UX, brand and design reviews', members: TEAM, by: 'designer' },
        { key: 'leadership', name: 'leadership', topic: 'Strategy, hiring and financials', type: 'PRIVATE', members: ['owner', 'admin'] },
        {
          key: 'client',
          name: 'client-collab',
          topic: 'Shared channel with our client for the website redesign',
          type: 'PRIVATE',
          members: ['owner', 'admin', 'designer', 'guest'],
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
              `🎨 **Whiteboard**: every channel has a shared, real-time whiteboard for sketching ideas together.\n\n` +
              `📎 **Files & search**: share files in any channel, browse them in channel storage, and search across messages.`,
          },
          {
            by: 'bot',
            ago: 3 * DAY - 4,
            text:
              `📋 **Projects & Kanban boards**: open **Projects** to find 3 sample projects: *Website Redesign*, *Mobile App v2* and *Product Launch Campaign*. Each has:\n` +
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
            reactions: [['✅', ['designer', 'engineer']]],
          },
        ],
        random: [
          {
            by: 'engineer',
            ago: 2 * DAY - 3 * HOUR,
            text: 'Anyone up for lunch at the new ramen place? 🍜',
            reactions: [['🍜', ['designer', 'admin']]],
            replies: [{ by: 'designer', text: 'Count me in!' }],
          },
          { by: 'designer', ago: DAY, text: 'Found a great read on building design systems that scale. Sharing in #design ☕' },
          { by: 'owner', ago: 3 * HOUR, text: 'Happy Friday everyone! 🎉 Great work this week.', reactions: [['🎉', ['admin', 'designer', 'engineer']]] },
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
          { by: 'admin', ago: 4 * HOUR, text: 'Release v2.0-beta is scheduled for next Tuesday. Please wrap up PRs by Monday EOD 🚢', pinned: true },
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
        ],
        leadership: [
          { by: 'owner', ago: DAY + 3 * HOUR, text: "Q3 numbers look strong 📈 Revenue is up 18% QoQ. Let's discuss hiring plans on Thursday." },
          { by: 'admin', ago: DAY + 2 * HOUR, text: "Sounds good. I'll prep the headcount proposal for engineering and design." },
        ],
        client: [
          {
            by: 'owner',
            ago: 2 * DAY - HOUR,
            text: `Welcome to our shared channel, ${mention('guest')} 👋 This is where we'll share progress and collect your feedback on the website redesign.`,
          },
          { by: 'guest', ago: 2 * DAY - 50 * MIN, text: 'Thanks! The new homepage direction looks fantastic. Could we see a mobile version before Friday?' },
          { by: 'designer', ago: 2 * DAY - 40 * MIN, text: "Absolutely, I'll share mobile mockups here by Thursday 📱", reactions: [['🙏', ['guest']]] },
        ],
        feedback: [
          { by: 'designer', ago: 2 * DAY, text: 'It would be great to have no-meeting Wednesdays so we can focus on deep work 🙏' },
          { by: 'engineer', ago: DAY + HOUR, text: 'Really appreciate how quickly leadership acted on last month\'s feedback. Thank you!' },
          { by: 'admin', ago: 7 * HOUR, text: 'Could we get a clearer process for prioritising bug reports?' },
        ],
        'dm-owner-admin': [
          { by: 'owner', ago: 5 * HOUR, text: 'Hey Marcus, can you send me the updated project timeline before the client call?' },
          { by: 'admin', ago: 5 * HOUR - 5, text: "Sure, I'll share it in 10 min 👍" },
        ],
        'dm-admin-engineer': [
          { by: 'admin', ago: 9 * HOUR, text: 'Great job on the auth flow, Daniel! 🙌' },
          { by: 'engineer', ago: 9 * HOUR - 3, text: 'Thanks! Push notifications are next.' },
        ],
        activity: [
          { by: 'bot', ago: 14 * DAY, text: `📢 **${u.admin.displayName}** created #engineering` },
          { by: 'bot', ago: 14 * DAY - 10, text: `📢 **${u.designer.displayName}** created #design` },
          { by: 'bot', ago: 2 * DAY - 5, text: `🔥 **${u.admin.displayName}** reacted to a message in #general` },
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
          managers: ['admin'],
          team: ['designer', 'engineer'],
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
            { col: 3, title: 'Finalize brand colour palette', priority: 'MEDIUM', who: 'designer', labels: ['Design'], due: -3, points: 2 },
            { col: 3, title: 'Kickoff meeting with client', priority: 'LOW', who: 'admin', labels: ['Planning'], due: -7, points: 1 },
          ],
        },
        {
          name: 'Mobile App v2',
          icon: '📱',
          color: '#3B82F6',
          description: 'Next major release of our iOS & Android app: new onboarding, offline mode and push notifications.',
          channel: 'engineering',
          managers: ['admin'],
          team: ['engineer', 'designer'],
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
            { col: 0, title: 'Offline mode for saved items', priority: 'HIGH', who: 'engineer', labels: ['Dev', 'Mobile'], due: 14, points: 8 },
            { col: 0, title: 'App Store screenshots & listing', priority: 'LOW', who: 'designer', labels: ['Design'], due: 12, points: 2 },
            {
              col: 1,
              title: 'Push notifications',
              priority: 'URGENT',
              who: 'engineer',
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
              comments: [['engineer', 'Implemented the first 3 screens, ready for review 👀']],
            },
            { col: 3, title: 'Email & password authentication', priority: 'HIGH', who: 'engineer', labels: ['Dev'], due: -2, points: 5 },
            { col: 3, title: 'Crash reporting setup', priority: 'MEDIUM', who: 'engineer', labels: ['Dev'], due: -5, points: 2 },
          ],
        },
        {
          name: 'Product Launch Campaign',
          icon: '🚀',
          color: '#F59E0B',
          description: 'Go-to-market campaign for the Q4 product launch: landing page, email sequence, social and press.',
          channel: 'general',
          managers: ['owner'],
          team: ['admin', 'designer'],
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
            { col: 0, title: 'Press release draft', priority: 'MEDIUM', who: 'admin', labels: ['Marketing'], due: 9, points: 3 },
            { col: 0, title: 'Launch day social posts', priority: 'LOW', who: 'designer', labels: ['Marketing', 'Design'], due: 11, points: 2 },
            { col: 1, title: 'Email nurture sequence (5 emails)', priority: 'HIGH', who: 'admin', labels: ['Marketing'], due: 5, points: 5 },
            { col: 2, title: 'Launch landing page', priority: 'URGENT', who: 'designer', labels: ['Design'], due: 1, points: 5 },
            { col: 3, title: 'Define target audience & messaging', priority: 'MEDIUM', who: 'owner', labels: ['Strategy'], due: -6, points: 3 },
          ],
        },
      ];

      const ref = (k: Key) => ({ uid: u[k].id, name: u[k].displayName });
      const notifications: { userId: string; workspaceId: string; type: 'SYSTEM'; title: string; body: string; createdAt: Date }[] = [];

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
          },
          include: { columns: { orderBy: { orderIndex: 'asc' } } },
        });

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

      // ---------- Availability history (last 5 weekdays) ----------
      const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' });
      const days: Date[] = [];
      for (let d = 1; days.length < 5; d++) {
        const date = new Date(Date.now() - d * DAY * 60_000);
        if (date.getDay() !== 0 && date.getDay() !== 6) days.push(date);
      }
      for (const [ui, k] of TEAM.entries()) {
        for (const day of days) {
          const start = new Date(`${dayFmt.format(day)}T09:${String(ui * 7).padStart(2, '0')}:00+05:00`);
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
