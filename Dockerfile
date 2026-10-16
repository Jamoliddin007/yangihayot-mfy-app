# Bitta image: frontend build + backend. Backend frontend'ni ham o'zi beradi.
FROM node:22-bookworm-slim AS base
# Prisma query engine uchun openssl kerak
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# --- Frontend build ---
FROM base AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Backend build ---
FROM base AS backend
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/prisma ./prisma
RUN npx prisma generate
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# --- Ishga tushadigan image ---
FROM base AS runtime
ENV NODE_ENV=production \
    FRONTEND_DIST=/app/frontend/dist
WORKDIR /app/backend
COPY --from=backend /app/backend/node_modules ./node_modules
COPY --from=backend /app/backend/dist ./dist
COPY --from=backend /app/backend/prisma ./prisma
COPY backend/package.json ./
COPY --from=frontend /app/frontend/dist /app/frontend/dist
USER node
EXPOSE 4000
# Har ishga tushishda yangi DB migratsiyalari avtomatik qo'llanadi
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/index.js"]
