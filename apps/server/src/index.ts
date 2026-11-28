import Fastify, {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { internalErrorHandler } from "./services/errorHandler.js";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";

// Routes
import { prisma } from "@orbit/db";
import { authRoutes } from "./routes/auth.js";
import { workspaceRoutes } from "./routes/workspaces.js";
import { channelRoutes } from "./routes/channels.js";
import { messageRoutes } from "./routes/messages.js";
import { huddleRoutes } from "./routes/huddles.js";
import { botRoutes } from "./routes/bots.js";
import { fileRoutes } from "./routes/files.js";
import { recordingRoutes } from "./routes/recordings.js";
import { adminRoutes } from "./routes/admin.js";
import { projectRoutes } from "./routes/projects.js";
import { pushRoutes } from "./routes/push.js";
import {
  availabilityRoutes,
  performAutoCheckoutBackfill,
} from "./routes/availability.js";
import { canvasRoutes } from "./routes/canvases.js";
import { documentRoutes } from "./routes/documents.js";
import { avatarRoutes } from "./routes/avatar.js";
import { todoRoutes } from "./routes/todos.js";
import { registerPushMiddleware } from "./services/pushService.js";
import { initFileSession } from "./services/fileAccess.js";
import { audit, pruneAuditLogs } from "./services/audit.js";
import { cleanupStagedUploads } from "./services/stagedUploads.js";

import { setupSocketServer } from "./socket/index.js";

// Load environment variables from apps/server/.env or root ../../.env
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../server/.env") });

// Extend Fastify types
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
    io: SocketIOServer;
  }
}

const PORT = parseInt(process.env.PORT || "4000", 10);
const HOST = process.env.HOST || "0.0.0.0";
// Values that were once hardcoded/committed (.env.example, old fallbacks): never acceptable in production.
const KNOWN_INSECURE_JWT_SECRETS = [
  "orbit_super_secret_jwt_access_token_key_1234567890",
  "orbit_production_jwt_secret_key_change_me",
  "change-me",
];

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!secret) {
      throw new Error(
        "JWT_SECRET is required in production. Generate one with: openssl rand -hex 48",
      );
    }
    if (secret.length < 32 || KNOWN_INSECURE_JWT_SECRETS.includes(secret)) {
      throw new Error(
        "JWT_SECRET is too short or a known default. Use at least 32 random characters.",
      );
    }
    return secret;
  }
  if (secret) return secret;
  // Dev only: random per process, so there is never a guessable secret. Sessions survive restarts via refresh tokens.
  console.warn(
    "JWT_SECRET is not set; using a random one for this process (access tokens reset on restart).",
  );
  return randomBytes(48).toString("hex");
}

const JWT_SECRET = resolveJwtSecret();
initFileSession(JWT_SECRET);
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// No default Redis credentials in production: the URL must be supplied. The local-development default matches
// docker-compose.yml and is never used when NODE_ENV=production.
function resolveRedisUrl(): string {
  const url = process.env.REDIS_URL?.trim();
  if (url) return url;
  if (IS_PRODUCTION) throw new Error("REDIS_URL is required in production.");
  return "redis://:orbit_redis_password@localhost:6379";
}
const REDIS_URL = resolveRedisUrl();

// Browsers may call the API only from the configured web origin(s). Production requires CLIENT_URL (plus any extra
// origins in CORS_ORIGINS, comma separated). Native apps and server-to-server calls send no Origin and are unaffected.
// Development stays open so localhost setups just work.
function resolveAllowedOrigins(): true | string[] {
  if (!IS_PRODUCTION) return true;
  const origins = [
    process.env.CLIENT_URL,
    ...(process.env.CORS_ORIGINS || "").split(","),
  ]
    .map((o) => o?.trim().replace(/\/+$/, ""))
    .filter((o): o is string => !!o);
  if (origins.length === 0)
    throw new Error("CLIENT_URL is required in production (CORS allow-list).");
  return origins;
}
const ALLOWED_ORIGINS = resolveAllowedOrigins();

// Behind a reverse proxy / load balancer the client address comes from X-Forwarded-For. TRUST_PROXY: "true", "false",
// a hop count, or a comma-separated list of proxy addresses/CIDRs. Defaults to true in production (the app is never
// exposed directly there); rate limiting and audit entries depend on this to see the real client address.
function resolveTrustProxy(): boolean | string | string[] | ((address: string, hop: number) => boolean) {
  const raw = process.env.TRUST_PROXY?.trim();
  if (!raw) return IS_PRODUCTION;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^\d+$/.test(raw)) {
    // Hop count: trust the nearest N proxies. Same rule Fastify applies to a numeric value; written as a function
    // because Fastify 5's types no longer accept a number here.
    const hops = parseInt(raw, 10);
    return (_address, hop) => hop < hops;
  }
  return raw.includes(",") ? raw.split(",").map((x) => x.trim()) : raw;
}

const intFromEnv = (name: string, fallback: number) => {
  const n = parseInt(process.env[name] || "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

async function bootstrap() {
  const fastify: FastifyInstance = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
    },
    trustProxy: resolveTrustProxy(),
  });

  // CORS
  await fastify.register(cors, {
    origin: ALLOWED_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // Security headers (nosniff, frame protection, HSTS, referrer policy). The API serves JSON and user files, never HTML
  // pages, so its CSP allows nothing to run or load. <img>/<video> embedding by the web app is not affected by a CSP on
  // the file itself; file responses set their own policy in services/fileResponse.ts.
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  });

  // Rate limiting per client address (shared across instances through Redis). Sensitive routes (sign-in, registration,
  // token refresh, password change, webhook/bot posting) set tighter limits in their own route options.
  const limiterRedis = new Redis(REDIS_URL, {
    connectTimeout: 500,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  limiterRedis.on("error", () => {}); // a Redis outage must not take the API down: limiting is skipped (skipOnError)
  const lastRateLimitAudit = new Map<string, number>();
  await fastify.register(rateLimit, {
    global: true,
    max: intFromEnv("RATE_LIMIT_MAX", 1200),
    timeWindow: "1 minute",
    redis: limiterRedis,
    nameSpace: "orbit-rl:",
    skipOnError: true,
    allowList: (req) =>
      req.url === "/api/health" || req.url.startsWith("/socket.io"),
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: "Too many requests. Please wait a moment and try again.",
      retryAfterSeconds: Math.ceil(context.ttl / 1000),
    }),
    onExceeded: (req, key) => {
      // Only sign-in related abuse is audited, and at most once a minute per client, so a flood of rejected requests
      // can't also flood the audit table.
      if (!req.url.startsWith("/api/auth")) return;
      const now = Date.now();
      if (now - (lastRateLimitAudit.get(key) ?? 0) < 60_000) return;
      lastRateLimitAudit.set(key, now);
      if (lastRateLimitAudit.size > 5000) {
        for (const [k, t] of lastRateLimitAudit)
          if (now - t > 60_000) lastRateLimitAudit.delete(k);
      }
      audit(req, {
        action: "security.rate_limited",
        outcome: "failure",
        metadata: { route: req.routeOptions?.url },
      });
    },
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
  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
        const payload = request.user as { id?: string };
        if (payload?.id) {
          const userRecord = await prisma.user.findUnique({
            where: { id: payload.id },
            select: { disabled: true },
          });
          // Valid JWT for a deleted user (e.g. after a DB reset): 401 so clients drop the session and sign in again.
          if (!userRecord) {
            return reply
              .status(401)
              .send({ error: "Unauthorized: user no longer exists" });
          }
          if (userRecord.disabled) {
            return reply.status(403).send({ error: "Account is deactivated" });
          }
        }
      } catch (err) {
        return reply
          .status(401)
          .send({ error: "Unauthorized: Invalid or expired token" });
      }
    },
  );

  // Create uploads directory if not exists
  const uploadDir =
    process.env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Socket.IO Setup with Redis Adapter
  const io = new SocketIOServer(fastify.server, {
    cors: {
      origin: ALLOWED_ORIGINS,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  try {
    const pubClient = new Redis(REDIS_URL);
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    fastify.log.info("Redis adapter connected for Socket.IO");
  } catch (redisError) {
    fastify.log.warn(
      "Could not connect Redis adapter, falling back to in-memory adapter",
    );
  }

  fastify.decorate("io", io);
  setupSocketServer(fastify, io);
  registerPushMiddleware(io);

  // Health Check
  fastify.get("/api/health", async () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "orbit-server",
    };
  });

  // Unexpected server errors are logged, never sent to the client; 4xx responses stay unchanged (see errorHandler.ts).
  // Must be set before the routes register so they inherit it.
  fastify.setErrorHandler(internalErrorHandler);

  // Register Routes
  await fastify.register(authRoutes, { prefix: "/api/auth" });
  await fastify.register(workspaceRoutes, { prefix: "/api/workspaces" });
  await fastify.register(channelRoutes, { prefix: "/api/channels" });
  await fastify.register(messageRoutes, { prefix: "/api/messages" });
  await fastify.register(huddleRoutes, { prefix: "/api/huddles" });
  await fastify.register(botRoutes, { prefix: "/api/bot" });
  await fastify.register(fileRoutes, { prefix: "/api/files" });
  await fastify.register(recordingRoutes, { prefix: "/api/recordings" });
  await fastify.register(adminRoutes, { prefix: "/api/admin" });
  await fastify.register(projectRoutes, { prefix: "/api/projects" });
  await fastify.register(pushRoutes, { prefix: "/api/push" });
  await fastify.register(availabilityRoutes, { prefix: "/api/availability" });
  await fastify.register(canvasRoutes, { prefix: "/api/canvases" });
  await fastify.register(documentRoutes, { prefix: "/api/documents" });
  await fastify.register(avatarRoutes, { prefix: "/api/avatar" });
  await fastify.register(todoRoutes, { prefix: "/api/todos" });

  // Start Server

  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(
      `🚀 Orbit Backend & Socket Server running on http://${HOST}:${PORT}`,
    );

    // Initial check for any unclosed sessions from previous days
    await performAutoCheckoutBackfill(fastify);

    // Schedule regular check every 15 minutes to guarantee auto-checkout at 4:00 AM PKT
    setInterval(
      () => {
        performAutoCheckoutBackfill(fastify).catch((err) => {
          fastify.log.error(err, "Auto-checkout backfill interval error");
        });
      },
      15 * 60 * 1000,
    );

    // Audit log retention (only when AUDIT_RETENTION_DAYS is set): prune now and once a day.
    pruneAuditLogs();
    setInterval(() => void pruneAuditLogs(), 24 * 60 * 60 * 1000);

    // Remove uploads that were never sent (see services/stagedUploads.ts): at start-up and every 6 hours.
    void cleanupStagedUploads();
    setInterval(() => void cleanupStagedUploads(), 6 * 60 * 60 * 1000);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

bootstrap();
