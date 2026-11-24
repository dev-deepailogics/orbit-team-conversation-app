import { Queue, Worker, Job } from "bullmq";
import { Server as SocketIOServer } from "socket.io";
import { prisma } from "@orbit/db";
import { SOCKET_EVENTS } from "@orbit/types";
import { syncMailAccount } from "./mailSyncService.js";
import { sendMail } from "./mailSendService.js";

const REDIS_URL =
  process.env.REDIS_URL || "redis://:orbit_redis_password@localhost:6379";

let syncQueue: Queue | null = null;
let sendQueue: Queue | null = null;
let syncWorker: Worker | null = null;
let sendWorker: Worker | null = null;
let ioInstance: SocketIOServer | null = null;

function parseRedisConnection(urlStr: string) {
  try {
    const parsed = new URL(urlStr);
    return {
      host: parsed.hostname || "localhost",
      port: parseInt(parsed.port || "6379", 10),
      password: parsed.password || undefined,
    };
  } catch {
    return { host: "localhost", port: 6379 };
  }
}

/**
 * Initializes BullMQ queues and workers for background mail operations
 */
export function initMailQueues(io?: SocketIOServer) {
  if (io) ioInstance = io;

  const connection = parseRedisConnection(REDIS_URL);

  try {
    syncQueue = new Queue("mail-sync", { connection });
    sendQueue = new Queue("mail-send", { connection });

    syncWorker = new Worker(
      "mail-sync",
      async (job: Job<{ accountId: string }>) => {
        const { accountId } = job.data;
        const res = await syncMailAccount(accountId, (info) => {
          if (ioInstance) {
            ioInstance.emit(SOCKET_EVENTS.MAIL_SYNC_STATUS, {
              accountId,
              ...info,
            });
          }
        });

        if (ioInstance) {
          ioInstance.emit(SOCKET_EVENTS.MAIL_SYNC_STATUS, {
            accountId,
            status: "IDLE",
            lastSyncedAt: new Date().toISOString(),
          });
        }
        return res;
      },
      {
        connection,
        concurrency: 3,
      }
    );

    sendWorker = new Worker(
      "mail-send",
      async (job: Job<{ userId: string; input: any }>) => {
        const { userId, input } = job.data;
        return await sendMail(userId, input);
      },
      {
        connection,
        concurrency: 5,
      }
    );

    syncWorker.on("failed", (job, err) => {
      console.error(`Mail sync job ${job?.id} failed:`, err.message);
      if (job?.data?.accountId && ioInstance) {
        ioInstance.emit(SOCKET_EVENTS.MAIL_SYNC_STATUS, {
          accountId: job.data.accountId,
          status: "ERROR",
          error: err.message,
        });
      }
    });

    sendWorker.on("failed", (job, err) => {
      console.error(`Mail send job ${job?.id} failed:`, err.message);
    });

    console.log("📨 Mail queues (BullMQ) successfully initialized with Redis");
  } catch (err: any) {
    console.warn(
      "Could not initialize Redis BullMQ queue; falling back to direct async execution:",
      err.message
    );
  }

  // Periodic sync every 4 minutes for active mail accounts
  setInterval(async () => {
    try {
      const activeAccounts = await prisma.mailAccount.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
      });

      for (const acc of activeAccounts) {
        await queueMailSync(acc.id);
      }
    } catch (intervalErr) {
      // Quiet background failure
    }
  }, 4 * 60 * 1000);
}

/**
 * Enqueues an account sync job
 */
export async function queueMailSync(accountId: string): Promise<void> {
  if (syncQueue) {
    await syncQueue.add(
      `sync-${accountId}`,
      { accountId },
      {
        removeOnComplete: true,
        removeOnFail: 100,
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
      }
    );
  } else {
    // In-memory fallback
    syncMailAccount(accountId).catch((err) => {
      console.error("Direct sync fallback error:", err.message);
    });
  }
}

/**
 * Enqueues an email sending job
 */
export async function queueMailSend(userId: string, input: any): Promise<any> {
  if (sendQueue) {
    const job = await sendQueue.add(
      `send-${userId}-${Date.now()}`,
      { userId, input },
      {
        removeOnComplete: true,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
      }
    );
    // Wait for result if needed, or return queued status
    return { queued: true, jobId: job.id };
  } else {
    // Direct execution fallback
    return await sendMail(userId, input);
  }
}
