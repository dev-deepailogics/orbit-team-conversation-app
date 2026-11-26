# Audit logging and SIEM forwarding

Orbit records security-relevant events in two places at once:

1. **Database table `audit_logs`**: searchable and exportable by a Super Admin (see below).
2. **Standard output**: one line per event, for a log shipper to forward to the SIEM.

Writing an audit entry never blocks or fails the request that caused it. Nothing sensitive is logged: no
passwords, tokens or message content.

## Event record

| Field | Meaning |
|---|---|
| `log_type` | Always `orbit.audit` (use it to filter these lines from other server logs) |
| `timestamp` | ISO 8601, UTC |
| `action` | Dotted event name (catalogue below) |
| `outcome` | `success` or `failure` |
| `actorId`, `actorLabel` | Who did it (user id; email/username at the time, also set for failed sign-ins) |
| `workspaceId` | Workspace the event belongs to, if any |
| `targetType`, `targetId` | What was acted on (user, workspace, file, channel, ...) |
| `ip`, `forwardedFor` | Source address as seen by the server, and the `X-Forwarded-For` header |
| `userAgent` | Client user agent |
| `metadata` | Small extra details (e.g. role change before/after, failure reason) |

## Event catalogue

| Area | Actions |
|---|---|
| Authentication | `auth.login` (password or Microsoft, success and failure with reason), `auth.register`, `auth.logout`, `auth.password_change`, `auth.refresh` (failure), `auth.refresh_token_reuse` |
| Platform administration | `admin.user_role_change`, `admin.user_disable`, `admin.user_enable`, `admin.user_password_reset`, `admin.user_delete`, `admin.workspace_create`, `admin.workspace_delete`, `admin.demo_workspace_create`, `admin.audit_log_view` |
| Workspace | `workspace.join`, `workspace.member_add`, `workspace.member_remove`, `workspace.member_role_change`, `workspace.update`, `workspace.settings_update` |
| Channels and messages | `channel.delete`, `message.delete` (author or admin) |
| Bots and integrations | `bot.create`, `bot.update`, `webhook.create` |
| Files and recordings | `file.upload`, `file.download` (success and denied), `file.delete`, `recording.delete` |
| Sharing | `document.share_add`, `document.share_remove`, `document.sharing_settings_change`, `drive.file_share_change` |

## Configuration

| Variable | Default | Effect |
|---|---|---|
| `AUDIT_LOG_FORMAT` | `json` | `json` (one JSON object per line) or `cef` (ArcSight Common Event Format) |
| `AUDIT_RETENTION_DAYS` | unset | If set, rows older than this are deleted from the database daily. The SIEM keeps its own copy. |

## Viewing and exporting (Super Admin)

`GET /api/admin/audit-logs`

Filters: `action` (prefix, e.g. `auth.`), `outcome`, `actorId`, `workspaceId`, `from`, `to` (ISO date/time),
`limit` (1-500), `cursor` (from `nextCursor`). Add `format=csv` to download up to 10,000 matching rows.
Viewing the log is itself recorded (`admin.audit_log_view`).

## Forwarding to the SIEM

Orbit writes to stdout, so any container log collector works. Filter on `"log_type":"orbit.audit"`.

**Fluent Bit** (reads Docker logs, forwards by syslog):

```ini
[INPUT]
    Name   tail
    Path   /var/lib/docker/containers/*/*-json.log
    Parser docker
[FILTER]
    Name   grep
    Match  *
    Regex  log orbit\.audit
[OUTPUT]
    Name    syslog
    Match   *
    Host    ${SIEM_HOST}
    Port    ${SIEM_PORT}
    Mode    tcp
    Syslog_Format rfc5424
    Syslog_Message_Key log
```

**Filebeat** (Elastic / Splunk / Sentinel via Logstash):

```yaml
filebeat.inputs:
  - type: container
    paths: ["/var/lib/docker/containers/*/*.log"]
    processors:
      - decode_json_fields: { fields: ["message"], target: "", overwrite_keys: true }
      - drop_event: { when: { not: { equals: { log_type: "orbit.audit" } } } }
output.logstash:
  hosts: ["${SIEM_HOST}:5044"]
```

On Google Cloud, container stdout goes to Cloud Logging automatically; create a log sink filtered on
`jsonPayload.log_type="orbit.audit"` and route it to the SIEM (Pub/Sub or the SIEM's connector).

## Database audit logging

- **Docker deployment:** `docker-compose.prod.yml` starts PostgreSQL with `log_connections`, `log_disconnections` and
  `log_statement=ddl`, so connections and schema changes appear in the container log and can be forwarded the same way.
- **Cloud SQL (KSIA GCP):** enable the `cloudsql.enable_pgaudit` flag and set `pgaudit.log` to `read,write,ddl,role`
  to capture queries and privileged operations. Cloud SQL sends them to Cloud Logging, from where the same sink applies.
