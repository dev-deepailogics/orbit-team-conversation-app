import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@orbit/db';
import { SOCKET_EVENTS } from '@orbit/types';
import crypto from 'crypto';
import { z } from 'zod';

const createBotSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().optional(),
  avatarUrl: z.string().optional(),
  scopes: z.array(z.string()).default(['chat:write']),
});

const postBotMessageSchema = z.object({
  channelId: z.string().min(1),
  text: z.string().min(1),
  attachments: z.array(z.object({
    fileUrl: z.string(),
    fileName: z.string(),
    fileType: z.string(),
    fileSize: z.number(),
  })).optional(),
});

const incomingWebhookSchema = z.object({
  text: z.string().min(1),
  attachments: z.array(z.any()).optional(),
});

export const botRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Create Bot App (Workspace Admin/Owner)
  fastify.post('/workspaces/:workspaceId/bots', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const userId = (request.user as { id: string }).id;

    const parseResult = createBotSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { name, description, avatarUrl, scopes } = parseResult.data;

    // Generate Slack-like bot token: xoxb-randomHex
    const botToken = `xoxb-${crypto.randomBytes(24).toString('hex')}`;

    const bot = await prisma.botApp.create({
      data: {
        workspaceId,
        name,
        description,
        avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`,
        botToken,
        scopes,
        createdById: userId,
      },
    });

    return reply.status(201).send(bot);
  });

  // List bots for workspace
  fastify.get('/workspaces/:workspaceId/bots', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const bots = await prisma.botApp.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(bots);
  });

  // Bot API: chat.postMessage (Slack-compatible Bearer Token authentication)
  fastify.post('/chat.postMessage', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ ok: false, error: 'invalid_auth' });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const bot = await prisma.botApp.findUnique({
      where: { botToken: token },
    });

    if (!bot || !bot.isActive) {
      return reply.status(401).send({ ok: false, error: 'invalid_token' });
    }

    const parseResult = postBotMessageSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ ok: false, error: parseResult.error.errors[0].message });
    }

    const { channelId, text, attachments } = parseResult.data;

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel || channel.workspaceId !== bot.workspaceId) {
      return reply.status(404).send({ ok: false, error: 'channel_not_found' });
    }

    const message = await prisma.message.create({
      data: {
        channelId,
        botAppId: bot.id,
        content: text,
        attachments: attachments && attachments.length > 0 ? {
          create: attachments.map((att) => ({
            fileUrl: att.fileUrl,
            fileName: att.fileName,
            fileType: att.fileType,
            fileSize: att.fileSize,
          })),
        } : undefined,
      },
      include: {
        bot: true,
        attachments: true,
        reactions: true,
        _count: { select: { replies: true } },
      },
    });

    const payload = {
      ...message,
      replyCount: 0,
    };

    if (fastify.io) {
      fastify.io.to(`channel:${channelId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, payload);
    }

    return reply.send({
      ok: true,
      channel: channelId,
      ts: message.createdAt.toISOString(),
      message: payload,
    });
  });

  // Create Incoming Webhook for Channel
  fastify.post('/workspaces/:workspaceId/channels/:channelId/webhooks', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { workspaceId, channelId } = request.params as { workspaceId: string; channelId: string };
    const userId = (request.user as { id: string }).id;
    const body = request.body as { name?: string };

    const webhook = await prisma.webhook.create({
      data: {
        workspaceId,
        channelId,
        name: body.name || 'Incoming Webhook',
        createdById: userId,
      },
    });

    return reply.status(201).send({
      id: webhook.id,
      name: webhook.name,
      token: webhook.token,
      url: `/api/webhooks/${webhook.token}`,
      createdAt: webhook.createdAt,
    });
  });

  // Trigger Incoming Webhook (Public POST)
  fastify.post('/webhooks/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const parseResult = incomingWebhookSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({ error: 'text is required' });
    }

    const webhook = await prisma.webhook.findUnique({
      where: { token },
      include: { channel: true },
    });

    if (!webhook) {
      return reply.status(404).send({ error: 'Webhook not found' });
    }

    const message = await prisma.message.create({
      data: {
        channelId: webhook.channelId,
        content: `**[Webhook: ${webhook.name}]**\n${parseResult.data.text}`,
      },
      include: {
        attachments: true,
        reactions: true,
        _count: { select: { replies: true } },
      },
    });

    const payload = { ...message, replyCount: 0 };

    if (fastify.io) {
      fastify.io.to(`channel:${webhook.channelId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, payload);
    }

    return reply.send({ success: true, messageId: message.id });
  });

  // Execute Slash Command (/poll, /topic, /shrug, /huddle, or custom registered bot commands)
  fastify.post('/commands/execute', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string; username: string }).id;
    const body = request.body as {
      channelId: string;
      workspaceId: string;
      commandText: string;
    };

    const { channelId, workspaceId, commandText } = body;
    const parts = commandText.trim().split(' ');
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return reply.status(404).send({ error: 'Channel not found' });

    // Built-in: /topic <new topic>
    if (commandName === '/topic') {
      const updatedChannel = await prisma.channel.update({
        where: { id: channelId },
        data: { topic: args },
      });

      const sysMsg = await prisma.message.create({
        data: {
          channelId,
          content: `📢 *Channel topic changed to:* **${args}**`,
        },
      });

      if (fastify.io) {
        fastify.io.to(`channel:${channelId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, { ...sysMsg, replyCount: 0 });
      }

      return reply.send({ ok: true, channel: updatedChannel });
    }

    // Built-in: /shrug [message]
    if (commandName === '/shrug') {
      const content = `${args ? args + ' ' : ''}¯\\_(ツ)_/¯`;
      const msg = await prisma.message.create({
        data: { channelId, userId, content },
        include: {
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } },
          attachments: true,
          reactions: true,
          _count: { select: { replies: true } },
        },
      });

      if (fastify.io) {
        fastify.io.to(`channel:${channelId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, { ...msg, replyCount: 0 });
      }

      return reply.send({ ok: true, message: msg });
    }

    // Built-in: /poll "Question" "Option 1" "Option 2" ...
    if (commandName === '/poll') {
      const matches = args.match(/"([^"]+)"|'([^']+)'|(\S+)/g) || [];
      const cleanArgs = matches.map((m) => m.replace(/^["']|["']$/g, ''));
      const question = cleanArgs[0] || 'Quick Poll';
      const options = cleanArgs.slice(1);

      const emojiNumbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      let pollBody = `📊 **POLL: ${question}**\n\n`;

      if (options.length > 0) {
        options.forEach((opt, idx) => {
          const emoji = emojiNumbers[idx] || `•`;
          pollBody += `${emoji} ${opt}\n`;
        });
      } else {
        pollBody += `👍 Yes / Agree\n👎 No / Disagree\n`;
      }

      const msg = await prisma.message.create({
        data: { channelId, userId, content: pollBody },
        include: {
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } },
          attachments: true,
          reactions: true,
          _count: { select: { replies: true } },
        },
      });

      // Auto-add emoji reactions
      if (options.length > 0) {
        for (let i = 0; i < Math.min(options.length, 10); i++) {
          await prisma.reaction.create({
            data: { messageId: msg.id, userId, emoji: emojiNumbers[i] },
          }).catch(() => {});
        }
      } else {
        await prisma.reaction.create({ data: { messageId: msg.id, userId, emoji: '👍' } }).catch(() => {});
        await prisma.reaction.create({ data: { messageId: msg.id, userId, emoji: '👎' } }).catch(() => {});
      }

      const updatedMsg = await prisma.message.findUnique({
        where: { id: msg.id },
        include: {
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } },
          attachments: true,
          reactions: true,
          _count: { select: { replies: true } },
        },
      });

      if (fastify.io && updatedMsg) {
        fastify.io.to(`channel:${channelId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, { ...updatedMsg, replyCount: 0 });
      }

      return reply.send({ ok: true, message: updatedMsg });
    }

    return reply.status(400).send({ error: `Unknown command: ${commandName}` });
  });
};
