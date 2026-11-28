import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@orbit/db';
import { LiveKitService } from '../services/livekit.js';
import { SOCKET_EVENTS } from '@orbit/types';
import { verifyChannelAccess } from '../utils/security.js';
import { emitToPublicChannel } from '../services/permissions.js';
import { CALL_JOINED, CALL_LEFT, CALL_STARTED, notifyCallEnded, notifyCallStarted } from '../services/pushService.js';
import { z } from 'zod';

// Same shape the channel message routes broadcast, so call records render like any message.
const messageInclude = {
  user: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } },
  bot: true,
  attachments: true,
  reactions: true,
} as const;

function formatDuration(ms: number) {
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'less than a minute';
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

const callChatSchema = z.object({ text: z.string().trim().min(1).max(4000) });

// The running call's "Started a call" message: its thread is the call's log (chat, joins, leaves).
async function findActiveCallRecord(channelId: string) {
  const huddle = await prisma.huddle.findFirst({ where: { channelId, isActive: true } });
  if (!huddle) return null;
  const record = await prisma.message.findFirst({
    where: { channelId, userId: huddle.hostUserId, content: CALL_STARTED, createdAt: { gte: huddle.startedAt } },
    orderBy: { createdAt: 'asc' },
  });
  return record;
}

/**
 * Adds an entry to the running call's thread as `userId` and broadcasts it like any thread reply.
 * `dedupe` skips an entry identical to the user's latest join/leave entry (clients can report the same leave twice).
 * Does nothing when no call record exists (e.g. anonymous channels never get one). Never throws: logging must not
 * break joining or leaving a call.
 */
async function logToCall(
  fastify: FastifyInstance,
  channelId: string,
  userId: string,
  content: string,
  dedupe = false,
): Promise<boolean> {
  try {
    const record = await findActiveCallRecord(channelId);
    if (!record) return false;
    if (dedupe) {
      const last = await prisma.message.findFirst({
        where: { parentMessageId: record.id, userId, content: { in: [CALL_JOINED, CALL_LEFT] } },
        orderBy: { createdAt: 'desc' },
      });
      if (last?.content === content) return false;
    }
    const entry = await prisma.message.create({
      data: { channelId, parentMessageId: record.id, userId, content },
      include: messageInclude,
    });
    fastify.io?.to(`channel:${channelId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, { ...entry, isThreadReply: true });
    return true;
  } catch (err) {
    console.error('Failed to log to call thread', err);
    return false;
  }
}

// Ends the huddle for everyone: closes its records, turns the "Started a call" message into "Call ended",
// tells the channel members and deletes the media room.
async function finishHuddle(fastify: FastifyInstance, channel: any) {
  const channelId: string = channel.id;
  const endedAt = new Date();
  const ending = await prisma.huddle.findMany({ where: { channelId, isActive: true } });
  await prisma.huddle.updateMany({
    where: { id: { in: ending.map((h) => h.id) } },
    data: {
      isActive: false,
      endedAt,
    },
  });

  // Turn each "Started a call" record into "Call ended · duration".
  for (const h of ending) {
    const record = await prisma.message.findFirst({
      where: { channelId, userId: h.hostUserId, content: CALL_STARTED, createdAt: { gte: h.startedAt } },
      orderBy: { createdAt: 'asc' },
    });
    if (!record) continue;
    const updated = await prisma.message.update({
      where: { id: record.id },
      data: { content: `📞 Call ended · lasted ${formatDuration(endedAt.getTime() - h.startedAt.getTime())}` },
      include: { ...messageInclude, _count: { select: { replies: true } } },
    });
    fastify.io?.to(`channel:${channelId}`).emit('message:updated', { ...updated, replyCount: updated._count.replies });
  }
  if (ending.length) {
    const members = channel.members.map((m: { userId: string }) => m.userId);
    notifyCallEnded(members, channelId).catch((err) => console.error('Call ended push failed', err));
  }

  // Clean up LiveKit room
  await LiveKitService.deleteRoom(`orbit-huddle-${channelId}`);

  if (fastify.io) {
    fastify.io.to(`workspace:${channel.workspaceId}`).emit(SOCKET_EVENTS.HUDDLE_ENDED, {
      channelId,
    });
  }
}

// How long to wait before re-checking a group call that still had people in it when someone left.
const emptyRoomRecheckMs = () => Number(process.env.HUDDLE_EMPTY_RECHECK_MS) || 10_000;

// Two people leaving at the same moment each see the other still connected, so neither ends the call.
// Re-check shortly after, and end it if the room turned out to be empty.
function scheduleEmptyCheck(fastify: FastifyInstance, channel: any) {
  const timer = setTimeout(async () => {
    try {
      const stillActive = await prisma.huddle.findFirst({ where: { channelId: channel.id, isActive: true } });
      if (!stillActive) return;
      const remaining = await LiveKitService.listParticipants(`orbit-huddle-${channel.id}`);
      if (remaining.length === 0) await finishHuddle(fastify, channel);
    } catch (err) {
      console.error('Empty huddle re-check failed', err);
    }
  }, emptyRoomRecheckMs());
  timer.unref?.();
}

export const huddleRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get LiveKit WebRTC Token for channel huddle
  fastify.post('/:channelId/token', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userPayload = request.user as { id: string; username: string };

    const access = await verifyChannelAccess(userPayload.id, channelId, reply);
    if (!access) return;
    const channel = access.channel;

    const roomName = `orbit-huddle-${channel.id}`;
    const token = await LiveKitService.createToken(roomName, userPayload.id, userPayload.username);

    return reply.send({
      token,
      roomName,
      serverUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880',
    });
  });

  // Start / Join Huddle / Call
  fastify.post('/:channelId/start', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userPayload = request.user as { id: string; username: string };

    const access = await verifyChannelAccess(userPayload.id, channelId, reply);
    if (!access) return;
    const channel = access.channel;

    const user = await prisma.user.findUnique({
      where: { id: userPayload.id },
    });

    let huddle = await prisma.huddle.findFirst({
      where: { channelId, isActive: true },
    });

    const isNew = !huddle;
    if (!huddle) {
      huddle = await prisma.huddle.create({
        data: {
          channelId,
          workspaceId: channel.workspaceId,
          hostUserId: userPayload.id,
          isActive: true,
        },
      });
    }

    // Only a new huddle rings and announces itself. Every joiner also calls /start, and re-announcing it each time
    // made the real caller receive "<joiner> started a call" the moment the callee answered (hostUserId was the joiner).
    if (fastify.io && isNew) {
      const callData = {
        channelId,
        channelName: channel.name,
        channelType: channel.type,
        channelTopic: channel.topic,
        huddleId: huddle.id,
        hostUserId: userPayload.id,
        callerName: user?.displayName || userPayload.username,
        callerAvatar: user?.avatarUrl,
        workspaceId: channel.workspaceId,
      };

      if (channel.type === 'PUBLIC') {
        await emitToPublicChannel(fastify.io, channel, SOCKET_EVENTS.HUDDLE_STARTED, callData);
      } else {
        for (const m of channel.members) {
          fastify.io.to(`user:${m.userId}`).emit(SOCKET_EVENTS.HUDDLE_STARTED, callData);
        }
      }
      fastify.io.to(`channel:${channelId}`).emit(SOCKET_EVENTS.HUDDLE_STARTED, callData);
    }

    if (!isNew) await logToCall(fastify, channelId, userPayload.id, CALL_JOINED, true);

    // /start also runs for every joiner; only the first one rings and leaves a record in the chat.
    if (isNew) {
      const recipients = channel.members.map((m: { userId: string }) => m.userId).filter((id: string) => id !== userPayload.id);
      notifyCallStarted(recipients, {
        channelId,
        channelName: channel.name,
        channelType: channel.type,
        callerName: user?.displayName || userPayload.username,
        hostUserId: userPayload.id,
        workspaceId: channel.workspaceId,
      }).catch((err) => console.error('Call push failed', err));

      // Anonymous channels never show who did what.
      if (!channel.isAnonymous) {
        const message = await prisma.message.create({
          data: { channelId, userId: userPayload.id, content: CALL_STARTED },
          include: messageInclude,
        });
        const payload = { ...message, replyCount: 0, workspaceId: channel.workspaceId };
        if (fastify.io) {
          if (channel.type === 'PUBLIC') {
            await emitToPublicChannel(fastify.io, channel, SOCKET_EVENTS.MESSAGE_NEW, payload);
          } else {
            for (const m of channel.members) fastify.io.to(`user:${m.userId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, payload);
            fastify.io.to(`channel:${channelId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, payload);
          }
        }
      }
    }

    return reply.send({ success: true, huddle });
  });

  // Leave / end a huddle. Clients call this when the user leaves the call. A direct call is between two people,
  // so it ends for both when either leaves; in a group call it only ends once the last person has left, so
  // one person leaving no longer drops everyone else.
  fastify.post('/:channelId/end', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userPayload = request.user as { id: string };

    const access = await verifyChannelAccess(userPayload.id, channelId, reply);
    if (!access) return;
    const channel = access.channel;

    // Record that this person left (also when it ends the call: the thread reads "<name> left the call", then "Call ended")
    await logToCall(fastify, channelId, userPayload.id, CALL_LEFT, true);

    // The leaver may still be listed while their own disconnect is in flight, so don't count them
    const others = (await LiveKitService.listParticipants(`orbit-huddle-${channelId}`)).filter(
      (p) => p.identity !== userPayload.id,
    );
    if (channel.type !== 'DIRECT' && others.length > 0) {
      scheduleEmptyCheck(fastify, channel);
      return reply.send({ success: true, ended: false });
    }

    await finishHuddle(fastify, channel);
    return reply.send({ success: true, ended: true });
  });

  // Saves a message sent in the in-call chat to the call's thread, so the conversation is kept after the call.
  // The in-call chat itself runs over LiveKit and disappears with the room; clients post their own messages here.
  fastify.post('/:channelId/chat', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userId = (request.user as { id: string }).id;

    const access = await verifyChannelAccess(userId, channelId, reply);
    if (!access) return;

    const parsed = callChatSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Message text is required' });

    const logged = await logToCall(fastify, channelId, userId, parsed.data.text);
    return reply.send({ success: true, logged });
  });

  // Get active participants for a huddle
  fastify.get('/:channelId/participants', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userPayload = request.user as { id: string };

    const access = await verifyChannelAccess(userPayload.id, channelId, reply);
    if (!access) return;

    const roomName = `orbit-huddle-${channelId}`;
    const livekitParticipants = await LiveKitService.listParticipants(roomName);

    // Fetch user details for each participant
    const userIds = livekitParticipants.map((p) => p.identity);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        displayName: true,
        username: true,
        avatarUrl: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const participants = livekitParticipants.map((p) => ({
      identity: p.identity,
      name: p.name,
      joinedAt: new Date(Number(p.joinedAt) * 1000).toISOString(),
      isMuted: p.tracks.some((t) => t.type === 0 && t.muted), // 0: AUDIO
      isVideoOn: p.tracks.some((t) => t.type === 1 && !t.muted), // 1: VIDEO
      user: userMap.get(p.identity) || null,
    }));

    return reply.send({ participants });
  });

  // Admin moderation: Mute participant
  fastify.post('/:channelId/mute-participant', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const { targetUserId, trackSid, muted } = request.body as { targetUserId: string; trackSid?: string; muted?: boolean };
    const userPayload = request.user as { id: string };

    const access = await verifyChannelAccess(userPayload.id, channelId, reply);
    if (!access) return;

    const roomName = `orbit-huddle-${channelId}`;
    const shouldMute = muted !== false;

    if (trackSid) {
      await LiveKitService.mutePublishedTrack(roomName, targetUserId, trackSid, shouldMute);
    } else {
      // Find audio track if trackSid is not specified
      const participants = await LiveKitService.listParticipants(roomName);
      const target = participants.find((p) => p.identity === targetUserId);
      const audioTrack = target?.tracks.find((t) => t.type === 0);
      if (audioTrack) {
        await LiveKitService.mutePublishedTrack(roomName, targetUserId, audioTrack.sid, shouldMute);
      }
    }

    return reply.send({ success: true });
  });

  // Admin moderation: Kick / Remove participant
  fastify.post('/:channelId/remove-participant', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const { targetUserId } = request.body as { targetUserId: string };
    const userPayload = request.user as { id: string };

    const access = await verifyChannelAccess(userPayload.id, channelId, reply);
    if (!access) return;

    const roomName = `orbit-huddle-${channelId}`;
    await LiveKitService.removeParticipant(roomName, targetUserId);

    return reply.send({ success: true });
  });
};

