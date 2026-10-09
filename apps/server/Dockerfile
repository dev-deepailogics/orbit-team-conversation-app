FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY apps/server/package.json ./apps/server/

RUN npm install

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
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app ./

EXPOSE 4000
CMD ["npm", "run", "start", "--workspace=@orbit/server"]
