# Security hardening settings

Settings added for production deployments. Existing deployments need the first three before upgrading.

| Setting | Required | Effect |
|---|---|---|
| `LIVEKIT_API_KEY` | Yes, in production | No default key any more (the compose file used to fall back to a public one). |
| `CLIENT_URL` | Yes, in production | Browser origin allowed by CORS and Socket.IO. Add more with `CORS_ORIGINS` (comma separated). |
| `REDIS_URL` | Yes, in production | No default Redis credentials in production. The compose file already sets it. |
| `TRUST_PROXY` | No (default `true` in production) | Read the client address from `X-Forwarded-For`. Rate limiting and audit entries need this behind a proxy or load balancer. Set `false` if the API is exposed directly, or to a hop count / proxy CIDR list. |
| `RATE_LIMIT_MAX` | No (default 1200) | Requests per minute per client address. Sign-in 10, registration 5, token refresh 60, password change 5, webhook/bot posting 300. Health checks and sockets are exempt. |
| `DISABLE_LOCAL_AUTH` | No | `true` accepts only Microsoft Entra ID sign-in. |
| `AUDIT_LOG_FORMAT`, `AUDIT_RETENTION_DAYS` | No | See `docs/audit-logging.md`. |

## What changed in the containers

- Base images and services are pinned to exact versions (Node 22.22 / Alpine 3.24, PostgreSQL 16.16, Redis 7.4.12,
  LiveKit v1.13.11). Update them deliberately, not by tag drift.
- The API and web containers run as the unprivileged `node` user with all Linux capabilities dropped and
  `no-new-privileges`. The API entrypoint keeps only CHOWN/SETUID/SETGID, long enough to fix ownership of an existing
  uploads volume (created by older root-running images) before dropping privileges.
- `prisma db push` runs with `--skip-generate`, so the running container never writes to its own code.

## Other behaviour

- API responses carry security headers (nosniff, frame protection, HSTS, referrer policy). Web pages add a
  permissions policy that allows only camera, microphone and screen capture for the app itself.
- Uploaded HTML, SVG, XML and script files are always downloaded, never displayed in the browser.
