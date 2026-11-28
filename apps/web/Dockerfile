FROM node:22.22-alpine3.24 AS builder

WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY apps/web/package.json ./apps/web/

# Explicitly set NODE_ENV=development for the install step so devDependencies are never omitted
ENV NODE_ENV=development
RUN npm install --include=dev

# Copy source files
COPY packages/types ./packages/types
COPY apps/web ./apps/web

# Next.js inlines NEXT_PUBLIC_* into the client bundle at build time
ARG NEXT_PUBLIC_SERVER_URL
# Call server address, used to build the Content-Security-Policy (next.config.mjs). Optional.
ARG NEXT_PUBLIC_LIVEKIT_URL
# next build breaks (prerender useContext null) if NODE_ENV=development leaks in as a build arg
ENV NODE_ENV=production

# Build packages
RUN npm run build --workspace=@orbit/types
RUN npm run build --workspace=@orbit/web

FROM node:22.22-alpine3.24 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Runs as the unprivileged "node" user; Next.js writes its runtime cache under .next
COPY --from=builder --chown=node:node /app ./
USER node

EXPOSE 3000
# Lets Docker / the hosting platform detect a stuck web server (SAST-010). /robots.txt is a tiny, always-200 route.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/robots.txt" || exit 1
CMD ["npm", "run", "start", "--workspace=@orbit/web"]
