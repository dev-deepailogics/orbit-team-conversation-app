# 🪐 Orbit

**Orbit** is an open-source, self-hostable team communication platform inspired by Slack. Built with **Next.js 14**, **Fastify & Node.js**, **Socket.IO**, **Prisma (PostgreSQL)**, **Redis**, and **LiveKit WebRTC SFU**.

Designed for seamless deployment on your own VPS with Docker and ready for cross-platform desktop distribution (Ubuntu/Linux, Windows, and macOS).

---

## 🚀 Key Features

- 🏢 **Multi-Tenant Workspaces & Organizations**: Switch between workspaces with unique custom slugs and invite links.
- 💬 **Channels & Direct Messages**: Public & private channels, 1:1 and group direct messaging.
- ⚡ **Real-Time Engine**: WebSocket-powered instant message delivery, live typing indicators, and user online/offline presence status.
- 🧵 **Message Threads**: Reply in threaded discussions without cluttering the main channel feed.
- 😀 **Rich Formatting & Emoji Reactions**: Full Markdown support, code blocks, file uploads, and emoji reactions.
- 🎧 **Huddles (Audio, Video & Screen Sharing)**: Ultra-low latency voice/video huddles powered by a self-hosted **LiveKit SFU** container. Supports active speaker detection and screen sharing.
- 🤖 **Bot & Integrations Developer Platform**:
  - Slack-compatible Bearer token API (`xoxb-...`)
  - Incoming webhooks for CI/CD, GitHub, Jira, and monitoring alerts
  - Slash command execution engine
- 📦 **Desktop App Ready**: Clean decoupled architecture compatible with Electron, Tauri, and Proton native wrappers.

---

## 🛠️ Architecture & Tech Stack

```
orbit-beta/
├── apps/
│   ├── web/               # Next.js 14 (App Router, Tailwind CSS, LiveKit React SDK)
│   └── server/            # Fastify + Socket.IO + JWT + LiveKit Server SDK
├── packages/
│   ├── db/                # Prisma ORM, PostgreSQL schema & seeders
│   └── types/             # Shared TypeScript models and socket event contracts
├── docker/
│   ├── Caddyfile          # Production reverse proxy with automatic SSL
│   └── livekit.yaml       # LiveKit SFU configuration
├── docker-compose.yml     # Local development infrastructure
├── docker-compose.prod.yml# VPS production deployment
```

---

## 💻 Quick Start (Local Development)

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v20+ or v22+)
- [Docker](https://www.docker.com/) & Docker Compose

### 2. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/orbit-beta.git
cd orbit-beta
npm install
```

### 3. Start Local Docker Services
```bash
docker compose up -d
```
*This spins up PostgreSQL 16, Redis 7, and LiveKit SFU.*

### 4. Setup Database & Seed Demo Data
```bash
# Push schema to Postgres and generate Prisma client
npm run db:push
npm run db:generate

# Seed demo workspace and accounts
npm run db:seed
```

### 5. Start Development Servers
```bash
# Runs both backend API (port 4000) and Next.js frontend (port 3000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**Demo Credentials:**
- Email: `demo@orbit.chat`
- Password: `password123`

---

## 🤖 Bot & Integrations API

### 1. Create a Bot
1. Open any workspace in Orbit.
2. Click the **Bot / Developer Portal** icon in the sidebar.
3. Name your bot and click **Create Bot**.
4. Copy your generated `xoxb-...` bot token.

### 2. Post a Message via cURL (Slack-compatible)
```bash
curl -X POST "http://localhost:4000/api/bot/chat.postMessage" \
  -H "Authorization: Bearer xoxb-YOUR_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "YOUR_CHANNEL_ID",
    "text": "🚀 *Deployment Successful!* Build #128 is now live on production."
  }'
```

### 3. Incoming Webhook
Send incoming payloads directly to a channel:
```bash
curl -X POST "http://localhost:4000/api/bot/webhooks/YOUR_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "🚨 Sentry Alert: Unhandled Exception in worker queue"
  }'
```

---

## 🌐 Deploying to your VPS (Production)

### 1. Configure DNS
Point your domain (e.g. `orbit.yourdomain.com`) to your VPS public IP address in your DNS manager (A record).

### 2. Configure Environment
On your VPS:
```bash
git clone <your-repo-url>
cd orbit-beta
cp .env.example .env
```
Edit `.env` to set your domain and production secrets:
```env
DOMAIN=orbit.yourdomain.com
JWT_SECRET=generate_a_secure_random_string_here
LIVEKIT_API_SECRET=generate_another_secure_random_string_here
```

### 3. Run Production Containers
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
Caddy will automatically provision and renew a free Let's Encrypt SSL certificate for your domain.

---

## 🖥️ Desktop Application Packaging (Linux, Windows, macOS)

Orbit's frontend is decoupled from server runtime and is packaged for desktop via **Tauri** or **Electron**:

```bash
# Using Tauri
cd apps/web
npx @tauri-apps/cli init
npx @tauri-apps/cli build
```
This generates native `.deb` / `.AppImage` (Ubuntu/Linux), `.msi` / `.exe` (Windows), and `.dmg` (macOS) binaries.
