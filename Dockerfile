# FROM node:22-alpine AS builder
FROM node:22-bookworm AS builder
WORKDIR /app

# Copy root lockfile + both workspace package manifests first (layer cache)
COPY package.json package-lock.json ./
COPY monitor-frontend/package.json ./monitor-frontend/
COPY monitor-backend/package.json ./monitor-backend/
COPY monitor-backend/prisma ./monitor-backend/prisma

# Single install from root — uses root lockfile, resolves all workspaces
RUN npm ci

# Copy sources (.dockerignore keeps node_modules out)
COPY monitor-frontend ./monitor-frontend
COPY monitor-backend ./monitor-backend

RUN npm run build -w monitor-frontend && npm run build -w monitor-backend

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Root node_modules has all hoisted packages — backend dist resolves against it
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/monitor-backend/dist ./dist
COPY --from=builder /app/monitor-backend/prisma ./prisma
COPY --from=builder /app/monitor-frontend/dist ./public
COPY monitor-backend/package.json ./

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
