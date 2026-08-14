# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# HNX-CIS Backend — Express API on Cloud Run, Cloud SQL (Postgres) via socket.
# ---------------------------------------------------------------------------

# ---------- Stage 1: build ----------
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---------- Stage 2: production dependencies only ----------
FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# ---------- Stage 3: runtime ----------
FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Drizzle migrations, kept in the image for reference / manual runs.
COPY drizzle ./drizzle

USER node

EXPOSE 8080

CMD ["node", "dist/server.cjs"]
