import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Routes
import { authRoutes } from './routes/auth.js';
import { workspaceRoutes } from './routes/workspaces.js';
import { channelRoutes } from './routes/channels.js';
import { messageRoutes } from './routes/messages.js';
import { huddleRoutes } from './routes/huddles.js';
import { botRoutes } from './routes/bots.js';
import { fileRoutes } from './routes/files.js';
import { adminRoutes } from './routes/admin.js';
import { setupSocketServer } from './socket/index.js';

dotenv.config();

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    io: SocketIOServer;
  }
}

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'orbit_super_secret_jwt_access_token_key_1234567890';
const REDIS_URL = process.env.REDIS_URL || 'redis://:orbit_redis_password@localhost:6379';

async function bootstrap() {
  const fastify: FastifyInstance = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // JWT
  await fastify.register(jwt, {
    secret: JWT_SECRET,
  });

  // Multipart uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max
    },
  });

  // Auth Decorator
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized: Invalid or expired token' });
    }
  });

  // Create uploads directory if not exists
  const uploadDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Socket.IO Setup with Redis Adapter
  const io = new SocketIOServer(fastify.server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  try {
    const pubClient = new Redis(REDIS_URL);
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    fastify.log.info('Redis adapter connected for Socket.IO');
  } catch (redisError) {
    fastify.log.warn('Could not connect Redis adapter, falling back to in-memory adapter');
  }

  fastify.decorate('io', io);
  setupSocketServer(fastify, io);

  // Health Check
  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString(), service: 'orbit-server' };
  });

  // Register Routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(workspaceRoutes, { prefix: '/api/workspaces' });
  await fastify.register(channelRoutes, { prefix: '/api/channels' });
  await fastify.register(messageRoutes, { prefix: '/api/messages' });
  await fastify.register(huddleRoutes, { prefix: '/api/huddles' });
  await fastify.register(botRoutes, { prefix: '/api/bot' });
  await fastify.register(fileRoutes, { prefix: '/api/files' });
  await fastify.register(adminRoutes, { prefix: '/api/admin' });

  // Start Server
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`🚀 Orbit Backend & Socket Server running on http://${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

bootstrap();
