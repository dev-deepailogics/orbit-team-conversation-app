# The Diary — What We Ran and What Happened (DAST)

> **What is this file?** A diary of the running-app safety check: **what** we ran, **when**, against **what**, and
> **what came out**. Rules are in [01-DAST-Plan.md](01-DAST-Plan.md).

---

## Round 1 — 27 November 2026

### 1. Basic facts

| | |
|---|---|
| Date and time | 2026-11-27, 17:45 – 19:10 (Pakistan time, UTC+05:00) |
| Target | Staging: `https://rqg7k0gf05u8qtuezlq0th9l.169.58.226.210.sslip.io` |
| Code on staging | **Older than `main`** (no security headers from commit `d1e44b6`, no login rate limit, no file-session cookie). Tested as it is, by decision. |
| Main test account | `pm@space.demo` (member). Also used: owner, admin, engineer, guest. Passwords never stored in files. |
| Second workspace | Channel `8942a869-e4ad-4f47-bc1d-f6ddf449b4a4` (workspace `d1cd3d0d-…`) |
| Done by | Orbit engineering, with AI help (Claude Code) |

### 2. Robots

| Robot | Version | How it ran |
|---|---|---|
| OWASP ZAP | 2.17.0 | Docker `ghcr.io/zaproxy/zaproxy:stable`, local only (`127.0.0.1:8090`), API key, `-silent` (no auto-updates, no outside calls) |
| Google Chrome | 158 | Driven by Playwright, through the ZAP proxy, to record real traffic |
| testssl.sh | 3.2 | Docker `drwetter/testssl.sh:3.2` |
| Python scripts | — | `security/dast/scripts/` (recording, token refresh, access-control checks) |

### 3. What we did, step by step

| Time | Step | Result |
|---|---|---|
| 17:45 | Two normal requests to `/` and `/api/health` | Staging up. Security headers missing → staging runs older code. |
| 18:05 | Moved Docker's storage to D: (C: was nearly full) | Done by the team in Docker Desktop. Local data intact. |
| 18:12 | Started ZAP (first attempt failed on add-on auto-update; fixed with `-silent`) | ZAP 2.17.0 ready |
| 18:15 | **Recorded real traffic**: Chrome logged in as `pm@` through the login page, opened channels, and called every read-only API route with real IDs (`record_traffic.py`) | 253 requests recorded; 63 API calls (59 OK, 3 admin pages correctly refused, 1 not present on staging). Token lifetime found: **15 minutes**. |
| 18:18 | **Passive scan** (ZAP only watches) | 0 High, 7 Medium, 205 Low, 72 Info — all about missing headers |
| 18:19 | Token helper started (`keep_token_fresh.py`): signs in every 10 min and gives ZAP the fresh token | Kept every scan request logged in |
| 18:20 | **Active scan** started. Limits: 2 parallel requests, 50 ms pause, 90 min max, 5 min per attack type. Never touched: logout, token refresh, password routes, live-chat socket, static files. Data-changing requests recorded: only login and "mark channel read". | — |
| 18:21 | **Access-control checks** (`access_checks.py`, read-only) | 63 PASS, 7 REVIEW, 6 "FAIL" → all 6 explained: `admin@space.demo` is a platform **SUPER_ADMIN** (see DAST-002) |
| ~18:33 | Laptop ran out of memory; this session restarted. Token helper and watcher stopped; **ZAP and the scan kept running**. | Checked: last token refresh 18:29 → valid until 18:44; helper restarted 18:38 → **no scan time lost** |
| 18:40 | **Workspace-wide lists check** (`guest_leak_check.py`): search, files, recordings for guest, engineer, pm, owner | 346 search results checked: **0** from channels the account is not in. (Search needs words of 3+ letters; first run with 1-letter words was invalid and redone.) Demo data has no files/recordings to test. |
| 18:50 | **HTTPS check** (testssl.sh) | Grade A- because "TLS 1.3 not supported" → checked with curl: **TLS 1.3 works** (tool false alarm). LUCKY13 and BREACH flagged as "potentially". |
| 18:58 | **Active scan finished** | 9,532 attack requests, staging stayed up the whole time. No injection or XSS found. Sample of 303 attack requests on `/api/`: 121 got 200 OK (logged in), only 8 got 401 (ZAP testing without login) → the scan really reached the API. |
| 19:00 | **Password-guessing check**: 15 wrong logins for a **non-existent** account | All 15 answered normally (401), none blocked (no 429) → DAST-001 |
| 19:05 | Stopped token helper and ZAP (to free memory). Saved reports. | — |

### 4. Proof files and fingerprints (SHA-256, first 16 characters)

Archived outside the repository in `D:\Orbit-Security-Evidence\Round1-2026-11\`.

| File | Archive folder | Fingerprint |
|---|---|---|
| zap-passive.json / .html | `dast-raw\` | `F80E657CD045DED8` / `D4752A6BDF032A5B` |
| zap-full.json / .html | `dast-raw\` | `22AF109261D2935E` / `C5046A2AE5675801` |
| testssl.json | `dast-raw\` | `D3DA51D7EB66D778` |
| results.json | `dast-evidence-access-control\` | `34FB3D57D3E2717E` |
| workspace-lists.json | `dast-evidence-access-control\` | `7F1CC5D454413E22` |

### 5. What we could NOT check this round

| What | Why | Plan |
|---|---|---|
| Changing data (create/edit/delete messages, channels, members) with attacks | Plan forbids risky changes on shared demo data | Round 2 in a dedicated test channel/workspace |
| File upload/download problems (SAST-004 on staging) | Demo workspace has no files; would need uploads | Fixed in code on `main`; re-test after deploy |
| Logged-in role changes (e.g. member making themselves admin) | Would change demo data | Round 2 with a throw-away workspace |
| Live-chat (Socket.IO) messages | Scanner can't attack WebSocket traffic well | Covered in the penetration test |
| Denial-of-service | Out of scope | — |
