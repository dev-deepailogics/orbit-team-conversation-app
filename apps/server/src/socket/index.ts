import { Server as SocketIOServer, Socket } from "socket.io";
import { FastifyInstance } from "fastify";
import { prisma } from "@orbit/db";
import { SOCKET_EVENTS } from "@orbit/types";
import { anonId } from "../services/anonymousService.js";
import {
  canUserAccessWorkspace,
  canUserAccessChannel,
  canUserAccessCanvas,
} from "../utils/security.js";
import { availabilityViewersRoom, getWorkspaceAccess } from "../services/permissions.js";

/** Viewers (OWNER/ADMIN/MANAGER/HR/SUPER_ADMIN) also get full availability updates for the workspace. */
async function joinAvailabilityViewersRoom(socket: Socket, userId: string, workspaceId: string) {
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (access.can("viewTeamAvailability")) socket.join(availabilityViewersRoom(workspaceId));
}

export function setupSocketServer(
  fastify: FastifyInstance,
  io: SocketIOServer,
) {
  // Store connected user socket mapping
  const userSocketMap = new Map<string, Set<string>>();

  prisma.user
    .updateMany({
      where: { status: { in: ["ONLINE", "IN_HUDDLE"] } },
      data: { status: "OFFLINE" },
    })
    .catch(() => {});

  // Socket Authentication Middleware: a valid, unexpired JWT for an active account is the only way in.
  io.use(async (socket: Socket, next) => {
    const token =
      (socket.handshake.auth?.token as string) ||
      (socket.handshake.headers?.authorization?.replace(
        "Bearer ",
        "",
      ) as string);

    if (!token) {
      return next(new Error('Authentication required for WebSocket connection'));
    }

    try {
      const decoded = fastify.jwt.verify(token) as { id: string; email: string; username: string };
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, disabled: true },
      });
      if (!user || user.disabled) {
        return next(new Error('Account is deactivated'));
      }
      socket.data.userId = decoded.id;
      socket.data.user = decoded;
      return next();
    } catch {
      return next(new Error('Invalid socket authentication token'));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const userId = socket.data.userId as string;
    const requestedWorkspaceId = socket.handshake.auth?.workspaceId as string;

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    // Track user presence
    if (!userSocketMap.has(userId)) {
      userSocketMap.set(userId, new Set());
    }
    userSocketMap.get(userId)?.add(socket.id);

    // Update user status to ONLINE in DB
    await prisma.user
      .update({
        where: { id: userId },
        data: { status: "ONLINE" },
      })
      .catch(() => {});

    // Join user's OWN private room only
    socket.join(`user:${userId}`);

    // Join initial workspace if authorized
    if (requestedWorkspaceId) {
      const hasWsAccess = await canUserAccessWorkspace(
        userId,
        requestedWorkspaceId,
      );
      if (hasWsAccess) {
        socket.join(`workspace:${requestedWorkspaceId}`);
        await joinAvailabilityViewersRoom(socket, userId, requestedWorkspaceId);
        io.to(`workspace:${requestedWorkspaceId}`).emit(
          SOCKET_EVENTS.USER_STATUS_CHANGE,
          {
            userId,
            status: "ONLINE",
          },
        );
      }
    }

    // Join User Private Room (strictly constrained to authenticated user)
    socket.on("user:join", (uId: string) => {
      if (uId === userId) {
        socket.join(`user:${userId}`);
      }
    });

    // Join Workspace Room (with membership authorization)
    socket.on(SOCKET_EVENTS.JOIN_WORKSPACE, async (wId: string) => {
      const hasAccess = await canUserAccessWorkspace(userId, wId);
      if (hasAccess) {
        socket.join(`workspace:${wId}`);
        await joinAvailabilityViewersRoom(socket, userId, wId);
      }
    });

    // Join Channel Room (with channel authorization)
    socket.on(SOCKET_EVENTS.JOIN_CHANNEL, async (channelId: string) => {
      const hasAccess = await canUserAccessChannel(userId, channelId);
      if (hasAccess) {
        socket.join(`channel:${channelId}`);
      }
    });

    // Leave Channel Room
    socket.on(SOCKET_EVENTS.LEAVE_CHANNEL, (channelId: string) => {
      socket.leave(`channel:${channelId}`);
    });

    // Typing indicator
    socket.on(SOCKET_EVENTS.TYPING_START, async ({ channelId, username }) => {
      const hasAccess = await canUserAccessChannel(userId, channelId);
      if (hasAccess) {
        const channel = await prisma.channel.findUnique({
          where: { id: channelId },
          select: { isAnonymous: true },
        });

        if (channel?.isAnonymous) {
          const member = await prisma.channelMember.findUnique({
            where: { channelId_userId: { channelId, userId } },
            select: { anonName: true, anonEmoji: true },
          });
          const safeName = member?.anonName
            ? `${member.anonEmoji || "🎭"} ${member.anonName}`
            : "Someone";
          socket.to(`channel:${channelId}`).emit(SOCKET_EVENTS.TYPING_START, {
            channelId,
            username: safeName,
            userId: anonId(channelId, userId),
          });
        } else {
          socket
            .to(`channel:${channelId}`)
            .emit(SOCKET_EVENTS.TYPING_START, { channelId, username, userId });
        }
      }
    });

    socket.on(SOCKET_EVENTS.TYPING_STOP, async ({ channelId }) => {
      const hasAccess = await canUserAccessChannel(userId, channelId);
      if (hasAccess) {
        const channel = await prisma.channel.findUnique({
          where: { id: channelId },
          select: { isAnonymous: true },
        });
        const safeUserId = channel?.isAnonymous
          ? anonId(channelId, userId)
          : userId;
        socket
          .to(`channel:${channelId}`)
          .emit(SOCKET_EVENTS.TYPING_STOP, { channelId, userId: safeUserId });
      }
    });

    // Real-Time Huddle Participant Sync
    socket.on(
      SOCKET_EVENTS.HUDDLE_JOINED,
      async ({
        channelId,
        workspaceId,
        user,
      }: {
        channelId: string;
        workspaceId: string;
        user?: any;
      }) => {
        const hasAccess = await canUserAccessChannel(userId, channelId);
        if (hasAccess) {
          // Mark user status as IN_HUDDLE
          await prisma.user
            .update({
              where: { id: userId },
              data: { status: "IN_HUDDLE" },
            })
            .catch(() => {});

          io.to(`workspace:${workspaceId}`).emit(
            SOCKET_EVENTS.USER_STATUS_CHANGE,
            {
              userId,
              status: "IN_HUDDLE",
            },
          );

          io.to(`workspace:${workspaceId}`).emit(SOCKET_EVENTS.HUDDLE_JOINED, {
            channelId,
            userId,
            user: user || socket.data.user,
          });
        }
      },
    );

    socket.on(
      SOCKET_EVENTS.HUDDLE_LEFT,
      async ({
        channelId,
        workspaceId,
      }: {
        channelId: string;
        workspaceId: string;
      }) => {
        // Revert user status to ONLINE
        await prisma.user
          .update({
            where: { id: userId },
            data: { status: "ONLINE" },
          })
          .catch(() => {});

        io.to(`workspace:${workspaceId}`).emit(
          SOCKET_EVENTS.USER_STATUS_CHANGE,
          {
            userId,
            status: "ONLINE",
          },
        );

        io.to(`workspace:${workspaceId}`).emit(SOCKET_EVENTS.HUDDLE_LEFT, {
          channelId,
          userId,
        });
      },
    );

    // Canvas (whiteboard) live collaboration: access is checked once on join,
    // after which room membership is the authorization for relaying events.
    socket.on(SOCKET_EVENTS.CANVAS_JOIN, async (canvasId: string) => {
      const canvas = await prisma.canvas.findUnique({
        where: { id: canvasId },
        select: { workspaceId: true, channelId: true },
      });
      if (canvas && (await canUserAccessCanvas(userId, canvas))) {
        socket.join(`canvas:${canvasId}`);
      }
    });

    socket.on(SOCKET_EVENTS.CANVAS_LEAVE, (canvasId: string) => {
      socket.leave(`canvas:${canvasId}`);
    });

    const relayCanvas = (event: string) => (payload: { canvasId: string }) => {
      const room = `canvas:${payload?.canvasId}`;
      if (socket.rooms.has(room)) {
        socket.to(room).emit(event, { ...payload, userId });
      }
    };
    socket.on(
      SOCKET_EVENTS.WHITEBOARD_UPDATE,
      relayCanvas(SOCKET_EVENTS.WHITEBOARD_UPDATE),
    );
    socket.on(
      SOCKET_EVENTS.WHITEBOARD_CURSOR,
      relayCanvas(SOCKET_EVENTS.WHITEBOARD_CURSOR),
    );
    socket.on(
      SOCKET_EVENTS.WHITEBOARD_CLEAR,
      relayCanvas(SOCKET_EVENTS.WHITEBOARD_CLEAR),
    );

    // Disconnect
    socket.on("disconnect", async () => {
      if (userId && userSocketMap.has(userId)) {
        const sockets = userSocketMap.get(userId);
        sockets?.delete(socket.id);

        if (!sockets || sockets.size === 0) {
          userSocketMap.delete(userId);
          await prisma.user
            .update({
              where: { id: userId },
              data: { status: "OFFLINE" },
            })
            .catch(() => {});

          if (requestedWorkspaceId) {
            io.to(`workspace:${requestedWorkspaceId}`).emit(
              SOCKET_EVENTS.USER_STATUS_CHANGE,
              {
                userId,
                status: "OFFLINE",
              },
            );
          }
        }
      }
    });
  });

  return io;
}
