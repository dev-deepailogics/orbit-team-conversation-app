# The Plan — Rules for the Running-App Safety Check (DAST)

| | |
|---|---|
| Document ID | ORBIT-SEC-DAST-PLAN |
| Version | 1.0 |
| Date | 2026-11-27 |
| Status | Approved for Round 1 |
| Owner | Orbit engineering team |

> **What is this file?** Before attacking our own app, we write down the rules: what we may attack, how hard, with
> which accounts, and what is off-limits. DAST is only legal and safe when these rules are agreed first.

---

## 1. What DAST is (simple words)

The app is **running**. A robot (OWASP ZAP) acts like a hacker **from the outside**: it logs in, clicks and calls every
part of the app with bad input, and watches whether the app breaks, leaks data or lets someone do something they
shouldn't. It does **not** look at our code.

## 2. Permission

| | |
|---|---|
| Approved by | Orbit engineering (project owner), 2026-11-27 |
| Approval covers | Full active scanning of the staging server below |
| Data on staging | Demo data only ("Space" demo workspace). No real customer data. |
| Server | Staging only. **Production is NOT tested.** |

## 3. Target (scope)

| Item | Value |
|---|---|
| Staging address | `https://rqg7k0gf05u8qtuezlq0th9l.169.58.226.210.sslip.io` |
| In scope | The website and everything under `/api/` and `/socket.io/` on that address |
| Not in scope | Any other address or server, the hosting platform itself, third-party services (Microsoft, Google, Firebase, LiveKit cloud), denial-of-service (flooding) attacks |
| Code version on staging | **Older than `main`.** Tested as it is, by decision. Findings may already be fixed on `main`; the report will say so per finding. |

## 4. Test accounts

All in the demo workspace **"Space"**. Passwords are **never** written into any file; they are given to the tools
only while they run.

| Role | Account | Used for |
|---|---|---|
| Owner | `owner@space.demo` | Checking owner-only features |
| Admin | `admin@space.demo` | Checking admin-only features |
| Member | `pm@space.demo` | **Main scanning account** |
| Member | `engineer@space.demo` | Second member: "can member A see member B's private things?" |
| Guest | `guest@space.demo` | "Can a guest reach member or admin features?" |

**Second workspace:** used to test "can one company see another company's data?". Provided by the Orbit team; one of its
channels is `8942a869-e4ad-4f47-bc1d-f6ddf449b4a4`. Accounts of the "Space" workspace must **not** be able to read it.

## 5. Robots (tools)

| Robot | What it does |
|---|---|
| **OWASP ZAP** (Docker, `ghcr.io/zaproxy/zaproxy:stable`) | Main scanner: passive watching + active attacks |
| **curl / scripts** | Manual checks: access control between roles, headers, file serving |
| **Google Chrome** (Playwright) | Proving browser-side problems for real, like in SAST-004 |

## 6. How hard we hit (safety limits)

| Rule | Why |
|---|---|
| **Passive scan first**, active scan after | Watching is harmless; attacking comes second |
| Active scan **slowed down** (few requests at a time) | So staging stays usable |
| **Never** send: delete requests, logout, password change, account disable, workspace delete | So the robot can't wreck the demo data or lock out accounts |
| Robot may create junk test data (messages, channels) only inside a dedicated test channel | Easy to clean up |
| **No** flooding / denial-of-service tests | Not in scope |
| Stop at once if staging goes down or someone reports a problem | Safety first |

## 7. How bad is a problem, and fix deadlines

Same scale as SAST: **Critical** (72 h) · **High** (14 days) · **Medium** (60 days) · **Low** (90 days).
Every robot alarm is checked by a person: real problem, or fake alarm (with the reason written down).

## 8. Steps

1. Plan (this file)
2. **Passive scan** logged in as a member
3. **Active scan** logged in as a member, on the API endpoints with real IDs
4. **Manual checks**: roles (guest/member/admin), private channels and DMs, the other workspace, file downloads
5. Person checks every alarm → problem list
6. Report

## 9. Proof

Every robot's original output is saved with a fingerprint (SHA-256) and archived **outside the repository** in
`D:\Orbit-Security-Evidence\` (one folder per round). Robots first write to `security/dast/reports/raw/` and
`security/dast/evidence/`, which git ignores; move the files to the archive after each round.
