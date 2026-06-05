# Build context: repository root (set via docker-compose context: .)
# ──────────────────────────────────────────────
# Stage 1 — Builder
# ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /usr/src/app

# SDK tarball must be at packages/iam-sdk/ (relative to showcase's package.json)
COPY packages/iam-sdk/iam-nestjs-sdk-1.0.0.tgz packages/iam-sdk/
COPY iam-showcase/package*.json iam-showcase/

WORKDIR /usr/src/app/iam-showcase
RUN npm ci --legacy-peer-deps

WORKDIR /usr/src/app
COPY iam-showcase/ iam-showcase/

WORKDIR /usr/src/app/iam-showcase
RUN npm run build

# ──────────────────────────────────────────────
# Stage 2 — Production
# ──────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /usr/src/app

COPY packages/iam-sdk/iam-nestjs-sdk-1.0.0.tgz packages/iam-sdk/
COPY iam-showcase/package*.json iam-showcase/

WORKDIR /usr/src/app/iam-showcase
RUN npm ci --omit=dev

COPY --from=builder /usr/src/app/iam-showcase/dist ./dist

EXPOSE 3010
CMD ["node", "dist/main"]
