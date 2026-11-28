# The Problem List — DAST (Running-App Check)

> Every problem found while attacking the running staging app, how bad it is, how to fix it, and whether it's
> already fixed in newer code. **Living list:** update it whenever something changes.

**Last updated:** 2026-11-27 (Round 1, staging, older code than `main`)

**"Fixed on main?"** tells you if the newest code already has the fix. If yes, it only needs deploying + a re-test.

---

## A. Scoreboard

| Level | Open | Fixed in code, verified locally (needs deploy + staging re-test) | Needs server admin | Total |
|---|---|---|---|---|
| 🟠 High | 0 | 1 | 0 | 1 |
| 🟡 Medium | 1 | 2 | 0 | 3 |
| 🟢 Low | 0 | 4 | 1 | 5 |
| **Total** | **1** | **7** | **1** | **9** |

## B. The list at a glance

| ID | Level | Problem in simple words | Status | Fix by |
|---|---|---|---|---|
| DAST-001 | 🟠 High | No limit on password guessing at login | ✅ Fixed in code (login: 10/min) — verified locally | 2026-12-11 (deploy) |
| DAST-002 | 🟡 Medium | A company account is a platform super-admin that can read **every** company's private messages | ❌ Open (setting + design decision) | 2027-01-26 |
| DAST-003 | 🟡 Medium | Website has no Content-Security-Policy ("allowed scripts" list) | ✅ Fixed in code — verified locally | 2027-01-26 (deploy) |
| DAST-004 | 🟡 Medium | Website pages can be put inside another site's frame (clickjacking) | ✅ Fixed in code — verified locally | 2027-01-26 (deploy) |
| DAST-005 | 🟢 Low | HTTPS-only (HSTS) and "don't guess file type" (nosniff) headers missing | ✅ Fixed in code — verified locally | 2027-02-25 (deploy) |
| DAST-006 | 🟢 Low | Live-chat connection says "any website may connect" | ✅ Fixed in code (production only) | 2027-02-25 (deploy) |
| DAST-007 | 🟢 Low | Website tells everyone it runs Next.js (`X-Powered-By`) | ✅ Fixed in code — verified locally | 2027-02-25 (deploy) |
| DAST-008 | 🟢 Low | Fonts load from Google without an integrity check | ✅ Fixed in code (fonts self-hosted) — verified locally | 2027-02-25 (deploy) |
| DAST-009 | 🟢 Low | HTTPS still allows older encryption modes (CBC) and compresses pages | 🛠 Settings file ready (`docker/traefik/tls-options.yml`); server admin must apply it | 2027-02-25 |

### Local verification (2026-11-28, real Chrome 158 + curl, local dev servers)

| Check | Result |
|---|---|
| 15 wrong logins (fake account) | 10 × 401, then **5 × 429 "too many requests"** → DAST-001 ✅ |
| Website headers | `Content-Security-Policy` present, **no `X-Powered-By`**, `X-Frame-Options`, `nosniff`, HSTS present → DAST-003/004/005/007 ✅ |
| API headers | HSTS, `nosniff`, `X-Frame-Options` present → DAST-005 ✅ |
| Chrome: login → app → channel | **0 CSP violations**, **0 requests to other sites** (no Google Fonts), all 7 fonts loaded → DAST-003/008 ✅ |

---

## C. Each problem explained

### 🟠 DAST-001 — No limit on password guessing at login
- **Where:** `POST /api/auth/login`
- **What we saw:** 15 wrong logins in a row (for a non-existent account) all got a normal "wrong password" answer;
  none were blocked. During the scan ZAP sent thousands of login attempts and was never slowed down.
- **Why it matters:** an attacker can try passwords forever. Weak passwords will eventually be guessed → account
  takeover.
- **Fixed on main?** ✅ Yes. Commit `d1e44b6` added rate limiting (`AUTH_LIMIT` in `routes/auth.ts`, stored in Redis).
- **To do:** deploy `main` to staging, repeat the 15-login test: attempts after the limit must get **429**.

### 🟡 DAST-002 — A company account is a platform super-admin
- **Where:** account `admin@space.demo` ("Head of Operations" in the Space workspace) has `systemRole = SUPER_ADMIN`.
- **What we saw:** this account could read the **other** workspace's channel: details, messages, pins, files,
  huddles, recordings. Normal accounts (owner, member, guest) were correctly refused.
- **Why it matters:** super-admins can read **every company's private messages**. That's by design for Orbit's own
  staff, but here the power sits on an account that looks like a normal company admin. If that password leaks, every
  customer's data leaks.
- **How to fix:**
  1. Give `SUPER_ADMIN` only to dedicated Orbit staff accounts, never to customer/company accounts.
  2. Decide if super-admins really need to **read messages** in other companies, or only manage accounts.
  3. Log every super-admin read of another company's data (audit log exists — make sure these reads are in it).
  4. Require extra login protection (2-factor) for super-admins.

### 🟡 DAST-003 — Website has no Content-Security-Policy
- **Where:** all website pages (e.g. `/login`, `/app`)
- **Why it matters:** CSP is a browser rule-book saying which scripts may run. Without it, any script-injection bug
  (today or in the future) is fully exploitable. It's a key second lock.
- **Fixed on main?** ❌ No. `next.config.mjs` adds other headers but no CSP.
- **How to fix:** add a CSP in `next.config.mjs` (start in report-only mode, then enforce), allowing only Orbit's
  own scripts, Google Fonts, LiveKit and the API address.

### 🟡 DAST-004 — Website can be framed by other sites (clickjacking)
- **Where:** all website pages
- **Why it matters:** a bad site can show Orbit inside an invisible frame and trick a logged-in user into clicking
  buttons (e.g. "delete", "add member").
- **Fixed on main?** ✅ Yes — `X-Frame-Options: SAMEORIGIN` in `next.config.mjs`. Deploy and re-test.

### 🟢 DAST-005 — HSTS and nosniff headers missing
- **Where:** website and API
- **Why it matters:** HSTS makes browsers always use HTTPS; nosniff stops browsers guessing file types.
- **Fixed on main?** ✅ Yes — `next.config.mjs` (website) and Helmet (API). Deploy and re-test.

### 🟢 DAST-006 — Live-chat connection allows any website
- **Where:** `/socket.io/` answers `Access-Control-Allow-Origin: *`
- **Why Low:** the chat connection logs in with a token (not a cookie), so another website can't use a visitor's
  login through it.
- **Fixed on main?** ✅ Yes — in production it only allows Orbit's own address (`ALLOWED_ORIGINS`).

### 🟢 DAST-007 — Website reveals it runs Next.js
- **Where:** header `X-Powered-By: Next.js` on website pages
- **Why it matters:** small clue for attackers about which known holes to try.
- **How to fix:** `poweredByHeader: false` in `next.config.mjs`.

### 🟢 DAST-008 — Fonts from Google without an integrity check
- **Where:** `<link href="https://fonts.googleapis.com/...">` on every page
- **Why it matters:** the app trusts an outside server for files on every page; also sends visitors' IPs to Google.
- **How to fix:** self-host the fonts with `next/font` (no outside request at all).

### 🟢 DAST-009 — Older HTTPS encryption modes and page compression
- **Where:** the HTTPS front door (Traefik)
- **What testssl.sh said:** overall grade A-; CBC cipher modes allowed (LUCKY13 "potentially vulnerable"), HTTP
  compression on (BREACH "potentially"). TLS 1.3 **does** work (tool's "not supported" was a false alarm, checked).
- **How to fix:** in Traefik's TLS options allow only modern AEAD ciphers (GCM/ChaCha20) for TLS 1.2.

---

## D. What passed (good news worth recording)

| Check | Result |
|---|---|
| 9,532 attack requests (SQL/NoSQL injection, script injection, command injection, path traversal, etc.) | ✅ Nothing found |
| Other company's channel (owner, member, guest) | ✅ Refused |
| Channels/DMs a user isn't in (member vs member, guest) | ✅ Refused |
| Admin-only pages for member and guest | ✅ Refused |
| Message search — results only from the user's own channels (346 results, 4 accounts) | ✅ Correct |
| API without login | ✅ Refused |
| HTTPS: old protocols off, valid certificate, 14 known attacks | ✅ Safe |

## E. Fake alarms / notes (closed)

| ID | Alert | Why closed |
|---|---|---|
| DAST-FP-01 | ZAP "User Agent Fuzzer" | Information only: login answers the same to different browsers |
| DAST-FP-02 | ZAP "Authentication / Session Management Response Identified" | Information only: ZAP found the login |
| DAST-FP-03 | ZAP "Re-examine Cache-control" | Information only, pages contain no secrets |
| DAST-FP-04 | testssl "TLS 1.3 not supported" | Wrong: a TLS-1.3-only connection succeeded |
| DAST-FP-05 | Access check "FAIL" ×6 for `admin@space.demo` | Not a bug in the checks — account is SUPER_ADMIN → reported as DAST-002 |

## F. Change history

| Date | What changed | By |
|---|---|---|
| 2026-11-27 | List created from Round 1 | Orbit engineering |
| 2026-11-28 | Fixed DAST-003 (CSP), 007 (X-Powered-By off), 008 (self-hosted fonts); verified 001/004/005/006 on `main`; Traefik TLS settings file for 009. DAST-002 left open by decision. | Orbit engineering |
