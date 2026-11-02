FROM node:22-alpine AS builder
# Prisma needs OpenSSL to pick and run its engine
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY apps/server/package.json ./apps/server/

# --include=dev: build tools are devDependencies; a NODE_ENV=production build arg would skip them
RUN npm install --include=dev

# Copy source files
COPY packages/types ./packages/types
COPY packages/db ./packages/db
COPY apps/server ./apps/server

# Build packages
RUN npm run build --workspace=@orbit/types
RUN npm run generate --workspace=@orbit/db
RUN npm run build --workspace=@orbit/db
RUN npm run build --workspace=@orbit/server

FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app ./

EXPOSE 4000
# Sync schema on boot; prisma refuses data-losing changes, so a destructive schema edit stops startup instead of dropping data
CMD ["sh", "-c", "npm run push --workspace=@orbit/db && npm run start --workspace=@orbit/server"]
