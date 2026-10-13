import { prisma } from '@orbit/db';

const ADJECTIVES = [
  'Thoughtful', 'Curious', 'Brave', 'Philosophical', 'Silent',
  'Clever', 'Wise', 'Dynamic', 'Calm', 'Bold',
  'Insightful', 'Wandering', 'Sharp', 'Serene', 'Vibrant',
  'Gentle', 'Honest', 'Mystic', 'Stealthy', 'Noble',
  'Creative', 'Keen', 'Radiant', 'Patient', 'Fearless',
  'Mindful', 'Pragmatic', 'Ingenious', 'Luminous', 'Harmonic',
  'Agile', 'Perceptive', 'Tenacious', 'Candid', 'Intuitive'
];

const NOUNS = [
  'Owl', 'Falcon', 'Fox', 'Otter', 'Sage',
  'Beaver', 'Lynx', 'Badger', 'Phoenix', 'Dolphin',
  'Panda', 'Eagle', 'Cheetah', 'Wolf', 'Raven',
  'Sparrow', 'Hawk', 'Tiger', 'Bear', 'Koala',
  'Explorer', 'Voyager', 'Observer', 'Architect', 'Pioneer',
  'Navigator', 'Philosopher', 'Seeker', 'Strategist', 'Alchemist',
  'Chronicler', 'Dreamer', 'Artisan', 'Guardian', 'Pathfinder'
];

export const CURATED_ANON_EMOJIS = [
  '🦊', '🦉', '🎭', '🦁', '🐬', '🐼', '🦅', '🐺', '🐨', '🐯',
  '🦔', '🦦', '🦡', '🐙', '🦄', '🚀', '💡', '🌿', '⚡', '🔮',
  '🛡️', '🎯', '🧩', '🌊', '🔥', '🧭', '🎨', '🌙', '⭐', '🕊️',
  '🏔️', '🪐', '🍁', '🔭', '💎', '🕯️', '⛵', '🌈', '🗝️', '🛸'
];

export function generateRandomPersona(): { anonName: string; anonEmoji: string } {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const emoji = CURATED_ANON_EMOJIS[Math.floor(Math.random() * CURATED_ANON_EMOJIS.length)];
  return {
    anonName: `${adj} ${noun}`,
    anonEmoji: emoji,
  };
}

export async function getOrCreateAnonProfile(channelId: string, userId: string) {
  let member = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: { channelId, userId },
    },
  });

  if (!member) {
    const persona = generateRandomPersona();
    member = await prisma.channelMember.create({
      data: {
        channelId,
        userId,
        anonName: persona.anonName,
        anonEmoji: persona.anonEmoji,
      },
    });
  } else if (!member.anonName || !member.anonEmoji) {
    const persona = generateRandomPersona();
    member = await prisma.channelMember.update({
      where: { id: member.id },
      data: {
        anonName: member.anonName || persona.anonName,
        anonEmoji: member.anonEmoji || persona.anonEmoji,
      },
    });
  }

  return {
    anonName: member.anonName!,
    anonEmoji: member.anonEmoji!,
  };
}

export function sanitizeMessageForViewer(message: any, viewerUserId: string, isAnonymousChannel: boolean): any {
  if (!isAnonymousChannel) {
    return {
      ...message,
      isSelf: message.userId === viewerUserId,
      isAnonymous: false,
    };
  }

  // System bot messages (e.g. from Orbit Bot)
  if (message.bot) {
    return {
      ...message,
      isSelf: false,
      isAnonymous: true,
    };
  }

  const isSelf = message.userId === viewerUserId;
  const anonDisplayName = message.anonName || 'Anonymous Member';
  const anonEmoji = message.anonEmoji || '🎭';

  let sanitizedQuotedMessage = message.quotedMessage;
  if (sanitizedQuotedMessage && !sanitizedQuotedMessage.bot) {
    const isQuotedSelf = sanitizedQuotedMessage.userId === viewerUserId;
    sanitizedQuotedMessage = {
      ...sanitizedQuotedMessage,
      userId: isQuotedSelf ? viewerUserId : 'anonymous',
      user: {
        id: isQuotedSelf ? viewerUserId : 'anonymous',
        username: isQuotedSelf ? (sanitizedQuotedMessage.user?.username || viewerUserId) : 'anonymous',
        displayName: sanitizedQuotedMessage.anonName || 'Anonymous Member',
        avatarUrl: null,
        anonEmoji: sanitizedQuotedMessage.anonEmoji || '🎭',
        isAnonymous: true,
      },
    };
  }

  // Mask reactions so user identity is not leaked
  const sanitizedReactions = (message.reactions || []).map((r: any) => {
    const isReactSelf = r.userId === viewerUserId;
    return {
      ...r,
      userId: isReactSelf ? viewerUserId : 'anonymous',
      user: isReactSelf
        ? { id: viewerUserId, displayName: 'You' }
        : { id: 'anonymous', displayName: 'Anonymous Member' },
    };
  });

  return {
    ...message,
    // Never expose other users' real IDs in anonymous channels
    userId: isSelf ? viewerUserId : `anon-${message.id.slice(0, 8)}`,
    user: {
      id: isSelf ? viewerUserId : `anon-${message.id.slice(0, 8)}`,
      username: isSelf ? (message.user?.username || viewerUserId) : 'anonymous',
      displayName: anonDisplayName,
      avatarUrl: null,
      anonEmoji,
      isAnonymous: true,
    },
    quotedMessage: sanitizedQuotedMessage,
    reactions: sanitizedReactions,
    anonName: anonDisplayName,
    anonEmoji,
    isAnonymous: true,
    isSelf,
  };
}
