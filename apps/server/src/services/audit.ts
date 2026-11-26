import { FastifyRequest } from 'fastify';
import { Prisma, prisma } from '@orbit/db';

/**
 * Security audit trail. Each event is stored in the audit_logs table (searchable, exportable by a Super Admin) and
 * written as one line to stdout so a log shipper (Filebeat, Fluent Bit, syslog) can forward it to the SIEM.
 *
 *   AUDIT_LOG_FORMAT=json (default)  one JSON object per line, with "log_type":"orbit.audit"
 *   AUDIT_LOG_FORMAT=cef             ArcSight CEF line, for SIEMs that expect it
 *   AUDIT_RETENTION_DAYS             if set, older rows are deleted from the database (the SIEM keeps its own copy)
 *
 * Writing an audit entry never blocks or fails the request that caused it.
 */

export interface AuditEvent {
  /** Dotted event name, e.g. "auth.login", "workspace.member_role_change", "file.download". */
  action: string;
  outcome?: 'success' | 'failure';
  actorId?: string | null;
  /** Email/username at the time. Also used when there is no user (e.g. a failed sign-in for an unknown email). */
  actorLabel?: string | null;
  workspaceId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  /** Small, non-sensitive details (never passwords, tokens or message content). */
  metadata?: Record<string, unknown>;
}

const MAX_FIELD = 500;
const clip = (v: string | null | undefined) => (v ? String(v).slice(0, MAX_FIELD) : null);

function requestContext(request: FastifyRequest | null | undefined) {
  if (!request) return { ip: null, forwardedFor: null, userAgent: null };
  const xff = request.headers['x-forwarded-for'];
  return {
    ip: clip(request.ip),
    forwardedFor: clip(Array.isArray(xff) ? xff.join(', ') : xff),
    userAgent: clip(request.headers['user-agent']),
  };
}

const cefEscapeHeader = (v: string) => v.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
const cefEscapeValue = (v: string) => v.replace(/\\/g, '\\\\').replace(/=/g, '\\=').replace(/\r?\n/g, ' ');

function formatLine(record: Record<string, unknown>): string {
  if ((process.env.AUDIT_LOG_FORMAT || 'json').toLowerCase() === 'cef') {
    const r = record as Record<string, string | null | undefined> & { metadata?: unknown };
    const ext = [
      `rt=${new Date(String(r.timestamp)).getTime()}`,
      r.actorId && `suser=${cefEscapeValue(r.actorId)}`,
      r.actorLabel && `suid=${cefEscapeValue(r.actorLabel)}`,
      r.ip && `src=${cefEscapeValue(r.ip)}`,
      r.userAgent && `requestClientApplication=${cefEscapeValue(r.userAgent)}`,
      r.targetType && `cs1Label=targetType cs1=${cefEscapeValue(r.targetType)}`,
      r.targetId && `cs2Label=targetId cs2=${cefEscapeValue(r.targetId)}`,
      r.workspaceId && `cs3Label=workspaceId cs3=${cefEscapeValue(r.workspaceId)}`,
      `outcome=${r.outcome}`,
      r.metadata && `msg=${cefEscapeValue(JSON.stringify(r.metadata))}`,
    ].filter(Boolean);
    const severity = r.outcome === 'failure' ? 5 : 3;
    return `CEF:0|Orbit|Orbit|1.0|${cefEscapeHeader(String(r.action))}|${cefEscapeHeader(String(r.action))}|${severity}|${ext.join(' ')}`;
  }
  return JSON.stringify(record);
}

/** Records an audit event. Fire-and-forget: errors are reported on stderr, never thrown. */
export function audit(request: FastifyRequest | null | undefined, event: AuditEvent): void {
  const ctx = requestContext(request);
  const record = {
    log_type: 'orbit.audit',
    timestamp: new Date().toISOString(),
    action: event.action,
    outcome: event.outcome ?? 'success',
    actorId: event.actorId ?? null,
    actorLabel: clip(event.actorLabel),
    workspaceId: event.workspaceId ?? null,
    targetType: event.targetType ?? null,
    targetId: event.targetId ?? null,
    ...ctx,
    ...(event.metadata ? { metadata: event.metadata } : {}),
  };

  try {
    process.stdout.write(formatLine(record) + '\n');
  } catch {
    /* stdout closed: nothing useful to do */
  }

  prisma.auditLog
    .create({
      data: {
        action: record.action,
        outcome: record.outcome,
        actorId: record.actorId,
        actorLabel: record.actorLabel,
        workspaceId: record.workspaceId,
        targetType: record.targetType,
        targetId: record.targetId,
        ip: ctx.ip,
        forwardedFor: ctx.forwardedFor,
        userAgent: ctx.userAgent,
        metadata: (event.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    })
    .catch((err) => console.error('audit log write failed:', (err as Error).message));
}

/** Deletes audit rows older than AUDIT_RETENTION_DAYS. No-op when the variable is unset. */
export async function pruneAuditLogs(): Promise<void> {
  const days = parseInt(process.env.AUDIT_RETENTION_DAYS || '', 10);
  if (!Number.isFinite(days) || days <= 0) return;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch((err) =>
    console.error('audit log prune failed:', (err as Error).message),
  );
}
