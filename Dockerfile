# ──────────────────────────────────────────────
# Stage 1 — Builder: compile TypeScript
# ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /usr/src/app

COPY package*.json ./
COPY packages/iam-sdk/ packages/iam-sdk/
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# ──────────────────────────────────────────────
# Stage 2 — Development: hot-reload watch mode
# ──────────────────────────────────────────────
FROM node:20-alpine AS development
WORKDIR /usr/src/app

COPY package*.json ./
COPY packages/iam-sdk/ packages/iam-sdk/
RUN npm ci --legacy-peer-deps

COPY . .
CMD ["npm", "run", "start:dev"]

# ──────────────────────────────────────────────
# Stage 3 — Runner
# Full deps + source + compiled dist.
# Used by: db-init (migrations/seeding) and the
# iam service container.
# ──────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/packages ./packages
COPY . .
COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main"]
