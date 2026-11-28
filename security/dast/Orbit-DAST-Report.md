**What we did.** We tested the running Orbit staging environment from the outside, the way an attacker would. A
real browser logged in through the normal login page and used the application while an industry-standard scanner
(OWASP ZAP) recorded every request. The scanner then sent **9,532 attack requests** to the website and API while
logged in. In addition, an engineer checked by hand that each type of user (owner, admin, member, guest, and a user
of another company) can reach only what they should, and the HTTPS configuration was tested.

**Important context.** Staging was running an **older version** of Orbit than the current development code. Several
findings below are **already fixed in the current code** and only need to be deployed and re-tested; each finding
says so.

### Positive results

- **No injection or script-injection weaknesses** were found in 9,532 attack requests (SQL/NoSQL injection, cross-site
  scripting, command injection, path traversal and others).
- **Company data is separated.** Users of one company could not read another company's channels.
- **Private channels and direct messages are protected.** Members and guests could not open conversations they are
  not part of, and message search returned results only from the user's own conversations (346 results checked).
- **Admin pages are protected** from members and guests, and the API refuses all requests without a login.
- **HTTPS is well configured:** outdated protocols are switched off, the certificate is valid, TLS 1.3 is supported,
  and none of 14 well-known HTTPS attacks apply.

### Issues found

| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | **No limit on password guessing** at login: an attacker can try passwords endlessly. | High | Fixed in current code — needs deployment |
| 2 | A company-level account holds **platform-wide super-admin** rights, which allow reading every company's private messages. | Medium | Configuration and design change needed |
| 3 | The website has **no Content Security Policy**, an important second line of defence against script injection. | Medium | Open |

**In total: 9 findings — 1 High, 3 Medium, 5 Low.** 4 are already fixed in the current code and need deployment and
re-testing.

---

## 2. What was tested (scope)

| Item | Detail |
|---|---|
| Environment | Staging only (demo data). Production was **not** tested. |
| Address | `https://rqg7k0gf05u8qtuezlq0th9l.169.58.226.210.sslip.io` |
| In scope | Website, API (`/api/`), real-time messaging endpoint |
| Accounts | Demo workspace "Space": owner, admin, members and a guest; plus a channel in a second workspace for cross-company tests |
| Not in scope | Production, other servers, third-party services (Microsoft, Google, Firebase, LiveKit cloud), denial-of-service testing |
| Date | 27 November 2026 |

---

## 3. How we tested

### 3.1 Tools

| Tool | Version | Purpose |
|---|---|---|
| **OWASP ZAP** | 2.17.0 | Recording traffic, passive analysis and active attack scanning |
| **Google Chrome** | 158 | Logging in and using the application like a real user |
| **testssl.sh** | 3.2 | HTTPS / TLS configuration check |
| Test scripts | — | Role-based access checks between users, companies and guests |

The scanner ran only on the test computer, with automatic updates and all other outside connections switched off.

### 3.2 Steps

1. **Plan** — agreed scope, accounts, safety limits and permission before testing.
2. **Record** — a real browser logged in and used the application; every request was recorded with real data
   identifiers.
3. **Passive scan** — the scanner analysed the recorded traffic without sending anything.
4. **Active scan** — the scanner attacked every recorded request while logged in, at a reduced speed. Logout,
   password, token-refresh and real-time messaging requests were excluded, and no requests that create, change or
   delete data were attacked, so the demo data stayed intact. Staging availability was checked every minute.
5. **Access-control checks** — owner, admin, member, guest and a user of another company each tried to read data
   they should and should not be able to see.
6. **HTTPS check** — protocols, certificate and known HTTPS attacks.
7. **Review** — an engineer reviewed every alert and confirmed or dismissed it.

---

## 4. How we rate findings

Same scale and deadlines as the SAST report: **Critical** — fix within 72 hours; **High** — 14 days; **Medium** —
60 days; **Low** — 90 days. Critical and High findings block release.

---

## 5. Results at a glance

| Severity | Findings |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 3 |
| Low | 5 |
| **Total** | **9** |

| ID | Severity | Finding | Fixed in current code? |
|---|---|---|---|
| DAST-001 | High | No limit on password guessing at login | Yes — needs deployment |
| DAST-002 | Medium | Company account has platform-wide super-admin rights | No |
| DAST-003 | Medium | No Content Security Policy on the website | No |
| DAST-004 | Medium | Website can be embedded in other sites (clickjacking) | Yes — needs deployment |
| DAST-005 | Low | HTTPS-only (HSTS) and file-type (nosniff) headers missing | Yes — needs deployment |
| DAST-006 | Low | Real-time messaging endpoint accepts connections from any website | Yes — needs deployment |
| DAST-007 | Low | Website reveals its framework (`X-Powered-By: Next.js`) | No |
| DAST-008 | Low | Fonts loaded from an external server without an integrity check | No |
| DAST-009 | Low | HTTPS still allows older encryption modes and page compression | No |

---

## 6. Findings in detail

### DAST-001 — No limit on password guessing at login

| | |
|---|---|
| **Severity** | High |
| **Location** | `POST /api/auth/login` |
| **Fixed in current code** | Yes — needs deployment |

**What we found.** Fifteen wrong login attempts in a row (using a non-existent account, so no real account was
affected) were all answered normally, and none were blocked. During the active scan, thousands of login attempts
were also accepted without any slowdown.

**Why it matters.** An attacker can keep guessing passwords without limit. Accounts with weak passwords would
eventually be taken over.

**Fix.** The current code already limits login attempts per minute. It must be deployed, and the test repeated:
attempts beyond the limit must be refused ("too many requests").

---

### DAST-002 — Company account has platform-wide super-admin rights

| | |
|---|---|
| **Severity** | Medium |
| **Location** | Account `admin@space.demo` (shown as "Head of Operations" of the Space company) |
| **Fixed in current code** | No — configuration and design decision |

**What we found.** This account has the **platform super-admin** role. It could read another company's channel,
including its messages, files and recordings. Normal accounts — including the company owner — were correctly
refused.

**Why it matters.** The super-admin role is intended for Orbit's own staff and can read **every company's private
messages**. Giving it to an account that looks like a normal company administrator means that if this account's
password is ever stolen, every customer's data is exposed.

**Fix.**
1. Give the super-admin role only to dedicated Orbit staff accounts, never to company accounts.
2. Decide whether super-admins need to read other companies' messages at all, or only manage accounts.
3. Record every super-admin access to another company's data in the audit log.
4. Require two-factor authentication for super-admin accounts.

---

### DAST-003 — No Content Security Policy on the website

| | |
|---|---|
| **Severity** | Medium |
| **Location** | All website pages |
| **Fixed in current code** | No |

**What we found.** The website does not send a Content Security Policy.

**Why it matters.** A Content Security Policy tells the browser which scripts are allowed to run. Without it, any
future script-injection bug can be fully exploited. It is a key second line of defence.

**Fix.** Add a policy that allows only Orbit's own scripts and its known services (fonts, video calls, API). Start in
"report-only" mode to avoid breaking features, then enforce it.

---

### DAST-004 — Website can be embedded in other sites (clickjacking)

| | |
|---|---|
| **Severity** | Medium |
| **Location** | All website pages |
| **Fixed in current code** | Yes — needs deployment |

**What we found.** Pages do not tell the browser to refuse being shown inside another website's frame.

**Why it matters.** A malicious site could show Orbit in an invisible frame and trick a logged-in user into clicking
buttons they cannot see.

**Fix.** The current code already sends `X-Frame-Options: SAMEORIGIN`. Deploy and re-test.

---

### DAST-005 — HTTPS-only and file-type headers missing

| | |
|---|---|
| **Severity** | Low |
| **Location** | Website and API |
| **Fixed in current code** | Yes — needs deployment |

**What we found.** The `Strict-Transport-Security` (always use HTTPS) and `X-Content-Type-Options: nosniff` (do not
guess file types) headers are missing.

**Fix.** Both are already added in the current code for the website and the API. Deploy and re-test.

---

### DAST-006 — Real-time messaging endpoint accepts any website

| | |
|---|---|
| **Severity** | Low |
| **Location** | `/socket.io/` |
| **Fixed in current code** | Yes — needs deployment |

**What we found.** The endpoint answers `Access-Control-Allow-Origin: *` (any website may connect).

**Why rated Low.** Connections log in with a token rather than a browser cookie, so another website cannot use a
visitor's login through it.

**Fix.** In production, the current code only allows Orbit's own address. Deploy and re-test.

---

### DAST-007 — Website reveals its framework

| | |
|---|---|
| **Severity** | Low |
| **Location** | Website pages — header `X-Powered-By: Next.js` |
| **Fixed in current code** | No |

**Why it matters.** It tells attackers which framework to research for known weaknesses.

**Fix.** Switch the header off in the website configuration (`poweredByHeader: false`).

---

### DAST-008 — Fonts loaded from an external server without an integrity check

| | |
|---|---|
| **Severity** | Low |
| **Location** | Every page loads fonts from `fonts.googleapis.com` |
| **Fixed in current code** | No |

**Why it matters.** Every page depends on an outside server, and visitors' addresses are shared with it.

**Fix.** Serve the fonts from Orbit's own server (built-in support in the website framework).

---

### DAST-009 — Older HTTPS encryption modes and page compression

| | |
|---|---|
| **Severity** | Low |
| **Location** | HTTPS front door (reverse proxy) |
| **Fixed in current code** | No — server configuration |

**What we found.** The HTTPS check rated the server **A-**. It still allows older "CBC" encryption modes (flagged as
potentially affected by the LUCKY13 attack) and compresses pages (flagged as potentially affected by BREACH). The
tool also reported that TLS 1.3 was not supported; we checked this directly and **TLS 1.3 works**.

**Fix.** Allow only modern encryption modes (AES-GCM, ChaCha20) for TLS 1.2 in the reverse-proxy settings.

---

## 7. Alerts reviewed and dismissed

| ID | Alert | Why dismissed |
|---|---|---|
| DAST-FP-01 | "User Agent Fuzzer" | Information only — the login page answers the same to different browsers |
| DAST-FP-02 | "Authentication / Session Management Response Identified" | Information only — the scanner recognised the login |
| DAST-FP-03 | "Re-examine Cache-control Directives" | Information only — the pages involved contain no private data |
| DAST-FP-04 | "TLS 1.3 not supported" | Incorrect — a TLS 1.3-only connection succeeded |
| DAST-FP-05 | Six access-check failures for `admin@space.demo` | Not an access-control fault — the account is a platform super-admin; reported as DAST-002 |

---

## 8. Fix plan

| Step | Work | Findings | Target date |
|---|---|---|---|
| A | **Deploy the current code to staging** (already contains these fixes) | DAST-001, 004, 005, 006 | 11 Dec 2026 |
| B | **Super-admin review:** remove the role from company accounts; decide on message access; audit and 2FA | DAST-002 | 26 Jan 2027 |
| C | **Website hardening:** Content Security Policy, hide framework header, self-host fonts | DAST-003, 007, 008 | 26 Jan 2027 |
| D | **HTTPS settings:** modern encryption modes only | DAST-009 | 25 Feb 2027 |
| E | **Round 2 re-test** after Step A, including the tests listed in section 9 | All | After Step A |

---

## 9. Limitations and pending work

| Item | Detail | Plan |
|---|---|---|
| **Older code on staging** | Results reflect the deployed version, not the current code. | Round 2 after deployment. |
| **Requests that change data** | Creating, editing and deleting data were not attacked, to protect the shared demo data. | Round 2 in a separate test workspace. |
| **File upload and download** | The demo workspace contains no files. A file-handling weakness found in the SAST review is fixed in the current code but not yet deployed. | Re-test after deployment. |
| **Role changes** (e.g. a member promoting themselves) | Would change demo data. | Round 2 in a separate test workspace. |
| **Real-time messaging** | The scanner cannot fully test WebSocket traffic. | Covered by the penetration test. |

---

## 10. Evidence

The original output of every tool was kept and fingerprinted (SHA-256). The evidence archive is available to the
client and auditors **on request**.

| Evidence | SHA-256 (first 16 characters) |
|---|---|
| ZAP passive scan report (JSON / HTML) | `F80E657CD045DED8` / `D4752A6BDF032A5B` |
| ZAP full scan report (JSON / HTML) | `22AF109261D2935E` / `C5046A2AE5675801` |
| HTTPS check (testssl.sh) | `D3DA51D7EB66D778` |
| Access-control check results | `34FB3D57D3E2717E` |
| Message search separation results | `7F1CC5D454413E22` |

---

## 11. Pass criteria and current status

| Criterion | Status |
|---|---|
| Scan completed while logged in, without disrupting staging | Met |
| Every alert reviewed and classified | Met |
| **No open Critical or High findings** | **Not met — 1 High (already fixed in current code, not yet deployed)** |
| Every Medium finding has an owner and a date | Met (see section 8) |
| Fixes confirmed by re-test | Pending (Round 2) |

**Result: not yet passed.** After the current code is deployed, Round 2 is expected to close the High finding.

---

## 12. Glossary

| Term | Meaning |
|---|---|
| **DAST** | Dynamic Application Security Testing — attacking the running application from the outside. |
| **Active / passive scan** | Passive: only observing traffic. Active: sending attack requests. |
| **Rate limiting** | Refusing requests when someone sends too many in a short time. |
| **Super-admin** | A platform-wide administrator role that can see all companies' data. |
| **Content Security Policy** | A browser rule-book listing which scripts a page may run. |
| **Clickjacking** | Tricking a user into clicking a hidden page inside an invisible frame. |
| **TLS / HTTPS** | The encryption that protects traffic between the browser and the server. |

---

## 13. Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Prepared by (Engineering / Security) | | | |
| Reviewed by (Technical Lead) | | | |
| Accepted by (Client) | | | |
