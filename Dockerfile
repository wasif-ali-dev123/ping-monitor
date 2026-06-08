FROM node:22-alpine AS fe-builder
WORKDIR /app
COPY monitor-frontend/package*.json ./monitor-frontend/
RUN npm ci --prefix monitor-frontend
COPY monitor-frontend ./monitor-frontend
RUN npm run build --prefix monitor-frontend

FROM node:22-alpine AS be-builder
WORKDIR /app
COPY monitor-backend/package*.json ./monitor-backend/
COPY monitor-backend/prisma ./monitor-backend/prisma
RUN npm ci --prefix monitor-backend
COPY monitor-backend ./monitor-backend
RUN npm run build --prefix monitor-backend

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=be-builder /app/monitor-backend/dist ./dist
COPY --from=be-builder /app/monitor-backend/node_modules ./node_modules
COPY --from=be-builder /app/monitor-backend/prisma ./prisma
COPY --from=be-builder /app/monitor-backend/package.json ./
COPY --from=fe-builder /app/monitor-frontend/dist ./public
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
