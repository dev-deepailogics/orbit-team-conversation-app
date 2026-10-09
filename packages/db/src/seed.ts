import { prisma } from './index';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Demo User
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@orbit.chat' },
    update: {},
    create: {
      email: 'demo@orbit.chat',
      username: 'demouser',
      displayName: 'Demo User',
      passwordHash,
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=demouser',
      status: 'ONLINE',
    },
  });

  // 2. Create Second Teammate User
  const sarah = await prisma.user.upsert({
    where: { email: 'sarah@orbit.chat' },
    update: {},
    create: {
      email: 'sarah@orbit.chat',
      username: 'sarah',
      displayName: 'Sarah Connor',
      passwordHash,
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=sarah',
      status: 'ONLINE',
    },
  });

  // 3. Create Demo Workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corp',
      slug: 'acme-corp',
      ownerId: demoUser.id,
      members: {
        create: [
          { userId: demoUser.id, role: 'OWNER' },
          { userId: sarah.id, role: 'MEMBER' },
        ],
      },
      channels: {
        create: [
          {
            name: 'general',
            topic: 'Company-wide announcements and work-based matters',
            type: 'PUBLIC',
            createdById: demoUser.id,
            members: {
              create: [{ userId: demoUser.id }, { userId: sarah.id }],
            },
          },
          {
            name: 'engineering',
            topic: 'Frontend, backend, infrastructure and deployments',
            type: 'PUBLIC',
            createdById: demoUser.id,
            members: {
              create: [{ userId: demoUser.id }, { userId: sarah.id }],
            },
          },
          {
            name: 'random',
            topic: 'Water cooler chat and funny links',
            type: 'PUBLIC',
            createdById: demoUser.id,
            members: {
              create: [{ userId: demoUser.id }, { userId: sarah.id }],
            },
          },
        ],
      },
    },
    include: {
      channels: true,
    },
  });

  // 4. Create Seed Messages
  const generalChannel = workspace.channels.find((c) => c.name === 'general');
  if (generalChannel) {
    const welcomeMsg = await prisma.message.create({
      data: {
        channelId: generalChannel.id,
        userId: sarah.id,
        content: '👋 Welcome to **Orbit**! Feel free to create channels, start huddles, and test bot integrations.',
      },
    });

    await prisma.message.create({
      data: {
        channelId: generalChannel.id,
        userId: demoUser.id,
        content: 'Thanks Sarah! The real-time messaging, audio/video huddle, and bot API look incredible.',
        parentMessageId: welcomeMsg.id,
      },
    });
  }

  console.log('✅ Seeding complete! Demo account: demo@orbit.chat / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
