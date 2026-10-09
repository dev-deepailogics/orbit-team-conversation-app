FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY apps/web/package.json ./apps/web/

RUN npm install

# Copy source files
COPY packages/types ./packages/types
COPY apps/web ./apps/web

# Build packages
RUN npm run build --workspace=@orbit/types
RUN npm run build --workspace=@orbit/web

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app ./

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=@orbit/web"]
