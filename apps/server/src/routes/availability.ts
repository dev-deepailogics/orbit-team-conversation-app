import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@orbit/db';
import { SOCKET_EVENTS } from '@orbit/types';
import { availabilityViewersRoom, canViewUserAvailability, getWorkspaceAccess } from '../services/permissions.js';

// Helper: Get today's local date YYYY-MM-DD in PKT (UTC+5)
function getTodayString(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
}

type AvailabilityWithBreaks = {
  id: string;
  userId: string;
  date: string;
  isAvailable: boolean;
  isOnBreak: boolean;
  breaks?: { id: string; breakReason: string; availableAfterBreak: Date | null }[];
};

/**
 * What any workspace member may see about someone else: working / on break / offline, plus the
 * reason of the open break (shown on presence dots). No times, durations or break history.
 */
export function toPresence(a: AvailabilityWithBreaks | null | undefined) {
  if (!a) return null;
  const openBreak = a.isOnBreak ? a.breaks?.find((b) => !b.availableAfterBreak) : undefined;
  return {
    id: a.id,
    userId: a.userId,
    date: a.date,
    isAvailable: a.isAvailable,
    isOnBreak: a.isOnBreak,
    breaks: openBreak ? [{ id: openBreak.id, breakReason: openBreak.breakReason, availableAfterBreak: null }] : [],
  };
}

/**
 * Sends AVAILABILITY_UPDATE so each socket gets exactly one copy: the full record for the user
 * themselves and for availability viewers (OWNER/ADMIN/MANAGER/HR/SUPER_ADMIN) of their workspaces,
 * presence-only for everyone else.
 */
export async function broadcastAvailability(
  fastify: FastifyInstance | undefined,
  userId: string,
  availability: AvailabilityWithBreaks,
) {
  const io = fastify?.io;
  if (!io) return;
  try {
    const memberships = await prisma.workspaceMember.findMany({ where: { userId }, select: { workspaceId: true } });
    const fullRooms = [`user:${userId}`, ...memberships.map((m) => availabilityViewersRoom(m.workspaceId))];
    io.to(fullRooms).emit(SOCKET_EVENTS.AVAILABILITY_UPDATE, { userId, availability });
    io.except(fullRooms).emit(SOCKET_EVENTS.AVAILABILITY_UPDATE, { userId, availability: toPresence(availability) });
  } catch (err) {
    console.error('Failed to broadcast availability update:', err);
  }
}

// Scheduled / on-demand Auto Checkout for any employee who forgot to check out (equivalent to 4:00 AM PKT Firebase Cloud Function)
export async function performAutoCheckoutBackfill(fastify?: FastifyInstance) {
  try {
    const today = getTodayString();
    const dangling = await prisma.userAvailability.findMany({
      where: {
        isAvailable: true,
        offTime: null,
        date: { lt: today },
      },
      include: { breaks: true },
    });

    if (dangling.length === 0) return;

    for (const rec of dangling) {
      const totalBreaks = rec.breaks.reduce((acc, b) => acc + (b.breakDurationMinutes || 0), 0);
      const start = new Date(rec.availableTime);
      // Auto-off time set to 23:00 UTC (04:00 AM PKT of the following morning)
      const autoOff = new Date(`${rec.date}T23:00:00.000Z`);
      const grossMinutes = Math.max(0, Math.round((autoOff.getTime() - start.getTime()) / 60000));
      const netMins = Math.max(0, grossMinutes - totalBreaks);

      const updated = await prisma.userAvailability.update({
        where: { id: rec.id },
        data: {
          offTime: autoOff,
          isAvailable: false,
          isOnBreak: false,
          isAutoCheckedOut: true,
          totalWorkingMinutes: netMins,
          updatedAt: autoOff,
        },
        include: { breaks: true },
      });

      await broadcastAvailability(fastify, rec.userId, updated);
    }
  } catch (err) {
    console.error('Error running performAutoCheckoutBackfill:', err);
  }
}

// NOTE: check-in state lives in UserAvailability and is broadcast via AVAILABILITY_UPDATE.
// User.status / USER_STATUS_CHANGE is owned by the socket layer and means "connected to Orbit",
// so these routes must never write it.
export const availabilityRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // 1. Get Current Availability Status for authenticated user
  fastify.get('/current', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userPayload = request.user as { id: string };
    const today = getTodayString();

    const record = await prisma.userAvailability.findFirst({
      where: {
        userId: userPayload.id,
        date: today,
      },
      include: {
        breaks: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({
      availability: record || null,
      serverTime: new Date().toISOString(),
    });
  });

  // 2. Check-In / Start Working (Available)
  fastify.post('/checkin', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userPayload = request.user as { id: string; username: string };
    const today = getTodayString();
    const now = new Date();

    let record = await prisma.userAvailability.findFirst({
      where: {
        userId: userPayload.id,
        date: today,
      },
      include: {
        breaks: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      // First check-in today: create new record
      record = await prisma.userAvailability.create({
        data: {
          userId: userPayload.id,
          date: today,
          availableTime: now,
          isAvailable: true,
          isOnBreak: false,
          isAutoCheckedOut: false,
        },
        include: { breaks: true },
      });
    } else {
      // Checking in after having checked out earlier today: convert the gap into an auto-break
      if (record.offTime) {
        const gapMinutes = Math.max(0, Math.round((now.getTime() - new Date(record.offTime).getTime()) / 60000));
        await prisma.availabilityBreak.create({
          data: {
            availabilityId: record.id,
            breakReason: 'Off Time Update',
            breakStartTime: record.offTime,
            availableAfterBreak: now,
            breakDurationMinutes: gapMinutes,
          },
        });
      }

      record = await prisma.userAvailability.update({
        where: { id: record.id },
        data: {
          offTime: null,
          isAvailable: true,
          isOnBreak: false,
          isAutoCheckedOut: false,
        },
        include: { breaks: true },
      });
    }

    await broadcastAvailability(fastify, userPayload.id, record);

    return reply.send({ success: true, availability: record, serverTime: now.toISOString() });
  });

  // 3. Take a Break
  fastify.post('/break/start', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userPayload = request.user as { id: string };
    const { reason } = (request.body as { reason?: string }) || {};
    const breakReason = reason || 'Short Break';
    const today = getTodayString();
    const now = new Date();

    const record = await prisma.userAvailability.findFirst({
      where: {
        userId: userPayload.id,
        date: today,
        isAvailable: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return reply.status(400).send({ error: 'Cannot take a break without checking in first.' });
    }

    if (record.isOnBreak) {
      return reply.status(400).send({ error: 'Already on break.' });
    }

    // Append new break record
    await prisma.availabilityBreak.create({
      data: {
        availabilityId: record.id,
        breakReason,
        breakStartTime: now,
      },
    });

    const updated = await prisma.userAvailability.update({
      where: { id: record.id },
      data: { isOnBreak: true },
      include: { breaks: true },
    });

    await broadcastAvailability(fastify, userPayload.id, updated);

    return reply.send({ success: true, availability: updated, serverTime: now.toISOString() });
  });

  // 4. Available After Break (Resume Working)
  fastify.post('/break/resume', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userPayload = request.user as { id: string };
    const today = getTodayString();
    const now = new Date();

    const record = await prisma.userAvailability.findFirst({
      where: {
        userId: userPayload.id,
        date: today,
        isAvailable: true,
        isOnBreak: true,
      },
      include: {
        breaks: {
          where: { availableAfterBreak: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.breaks.length === 0) {
      return reply.status(400).send({ error: 'No open break found to resume from.' });
    }

    const openBreak = record.breaks[0];
    const durationMinutes = Math.max(
      1,
      Math.round((now.getTime() - new Date(openBreak.breakStartTime).getTime()) / 60000)
    );

    // Close the break
    await prisma.availabilityBreak.update({
      where: { id: openBreak.id },
      data: {
        availableAfterBreak: now,
        breakDurationMinutes: durationMinutes,
      },
    });

    const updated = await prisma.userAvailability.update({
      where: { id: record.id },
      data: { isOnBreak: false },
      include: { breaks: true },
    });

    await broadcastAvailability(fastify, userPayload.id, updated);

    return reply.send({ success: true, availability: updated, serverTime: now.toISOString() });
  });

  // 5. Checkout (End of Shift)
  fastify.post('/checkout', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userPayload = request.user as { id: string };
    const today = getTodayString();
    const now = new Date();

    const record = await prisma.userAvailability.findFirst({
      where: {
        userId: userPayload.id,
        date: today,
        isAvailable: true,
      },
      include: {
        breaks: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return reply.status(400).send({ error: 'No active session found to checkout.' });
    }

    // Auto-close any pending break if open
    let totalBreakMinutes = 0;
    for (const b of record.breaks) {
      if (!b.availableAfterBreak) {
        const dur = Math.max(1, Math.round((now.getTime() - new Date(b.breakStartTime).getTime()) / 60000));
        await prisma.availabilityBreak.update({
          where: { id: b.id },
          data: { availableAfterBreak: now, breakDurationMinutes: dur },
        });
        totalBreakMinutes += dur;
      } else {
        totalBreakMinutes += b.breakDurationMinutes;
      }
    }

    // Net working minutes calculation: (Now - AvailableTime) - Sum(Breaks)
    const totalElapsedMinutes = Math.max(
      0,
      Math.round((now.getTime() - new Date(record.availableTime).getTime()) / 60000)
    );
    const netWorkingMinutes = Math.max(0, totalElapsedMinutes - totalBreakMinutes);

    const updated = await prisma.userAvailability.update({
      where: { id: record.id },
      data: {
        offTime: now,
        isAvailable: false,
        isOnBreak: false,
        totalWorkingMinutes: netWorkingMinutes,
      },
      include: { breaks: true },
    });

    await broadcastAvailability(fastify, userPayload.id, updated);

    return reply.send({ success: true, availability: updated, serverTime: now.toISOString() });
  });

  // 6. Get Workspace Team Availability (for Organization Control panel)
  fastify.get('/team/:workspaceId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const callerId = (request.user as { id: string }).id;
    const today = getTodayString();

    const access = await getWorkspaceAccess(callerId, workspaceId);
    if (!access.isMember && access.systemRole !== 'SUPER_ADMIN') {
      return reply.status(403).send({ error: 'You are not a member of this workspace' });
    }
    // Viewers get everyone's full records; others get presence only (their own record stays full).
    const canViewTeam = access.can('viewTeamAvailability');
    const canSeeDetails = (userId: string) => canViewTeam || userId === callerId;

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            username: true,
            email: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
    });

    const userIds = members.map((m) => m.userId);

    // 1. Run auto checkout backfill for any dangling unclosed sessions from previous days
    await performAutoCheckoutBackfill(fastify);

    const todayAvailabilities = await prisma.userAvailability.findMany({
      where: {
        userId: { in: userIds },
        date: today,
      },
      include: {
        breaks: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const availabilityMap = new Map<string, (typeof todayAvailabilities)[number]>();
    for (const rec of todayAvailabilities) {
      if (!availabilityMap.has(rec.userId)) {
        availabilityMap.set(rec.userId, rec);
      }
    }

    // Members not checked in today: their most recent past session as latestSession.
    // One query for all of them (was one query per member), and only for members whose details the caller may see.
    const needPast = userIds.filter((id) => !availabilityMap.has(id) && canSeeDetails(id));
    const pastRecords = needPast.length
      ? await prisma.userAvailability.findMany({
          where: { userId: { in: needPast } },
          include: {
            breaks: {
              orderBy: { breakStartTime: 'asc' },
            },
          },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          distinct: ['userId'],
        })
      : [];
    const latestPastMap = new Map(pastRecords.map((r) => [r.userId, r]));

    const teamList = members.map((m) => {
      const todayRec = availabilityMap.get(m.userId);
      if (!canSeeDetails(m.userId)) {
        return { user: m.user, role: m.role, availability: toPresence(todayRec), latestSession: null };
      }
      const pastRec = latestPastMap.get(m.userId);
      return {
        user: m.user,
        role: m.role,
        availability: todayRec || null,
        latestSession: pastRec || todayRec || null,
      };
    });

    return reply.send({
      date: today,
      serverTime: new Date().toISOString(),
      team: teamList,
      myRole: access.role,
      permissions: { viewTeamAvailability: canViewTeam },
    });
  });

  // 7. Get History Calendar for a specific user (by Month / Year)
  fastify.get('/history/:userId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { year, month } = request.query as { year?: string; month?: string };

    const callerId = (request.user as { id: string }).id;
    if (!(await canViewUserAvailability(callerId, userId))) {
      return reply.status(403).send({ error: 'You can only view your own availability' });
    }

    const currentYear = year ? parseInt(year, 10) : new Date().getFullYear();
    const currentMonth = month ? parseInt(month, 10) : new Date().getMonth() + 1;

    const monthStr = currentMonth.toString().padStart(2, '0');
    const prefix = `${currentYear}-${monthStr}`;

    const records = await prisma.userAvailability.findMany({
      where: {
        userId,
        date: {
          startsWith: prefix,
        },
      },
      include: {
        breaks: {
          orderBy: { breakStartTime: 'asc' },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Normalize and compute totalWorkingMinutes if stored as 0 but valid start & end timestamps exist
    const processedRecords = records.map((rec) => {
      let netMins = rec.totalWorkingMinutes;
      const breaks = rec.breaks || [];
      const breakMins = breaks.reduce((acc, b) => acc + (b.breakDurationMinutes || 0), 0);

      if ((!netMins || netMins === 0) && rec.availableTime && rec.offTime) {
        const startMs = new Date(rec.availableTime).getTime();
        const endMs = new Date(rec.offTime).getTime();
        const grossSpanMins = Math.max(0, Math.round((endMs - startMs) / 60000));
        netMins = Math.max(0, grossSpanMins - breakMins);
      }

      return {
        ...rec,
        totalWorkingMinutes: netMins,
      };
    });

    return reply.send({
      year: currentYear,
      month: currentMonth,
      records: processedRecords,
    });
  });

  // 8. Get specific single availability detail
  fastify.get('/detail/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const record = await prisma.userAvailability.findUnique({
      where: { id },
      include: {
        breaks: {
          orderBy: { breakStartTime: 'asc' },
        },
        user: {
          select: {
            id: true,
            displayName: true,
            username: true,
            email: true,
            role: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!record) {
      return reply.status(404).send({ error: 'Availability record not found' });
    }

    const callerId = (request.user as { id: string }).id;
    if (!(await canViewUserAvailability(callerId, record.userId))) {
      return reply.status(403).send({ error: 'You can only view your own availability' });
    }

    return reply.send({ record });
  });
};


