# Generic IAM Service

A robust, multi-tenant Identity and Access Management (IAM) service built with NestJS, designed using Clean Architecture principles. It handles authentication, Role-Based Access Control (RBAC), fine-grained Access Control Lists (ACL), and comprehensive audit logging.

## Architecture Summary
- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL (Row-Level Security for strict tenant isolation)
- **Caching**: Redis (Cache-aside for permission checks)
- **Messaging/Events**: Kafka (Audit logs, cache invalidation, external events)
- **Design Pattern**: Domain-Driven Design (DDD) with Clean Architecture layers
- **Authentication**: JWT, cross-tenant capable
- **Authorization**: Extensible RBAC (Role + Overrides) and ACL (Resource specific)

## Prerequisites
- Docker >= 24 and Docker Compose v2
- Node.js >= 20.x (local dev only)

## Quick Start — Docker (Recommended)

Everything runs with a single command. No local database, Redis, or Kafka setup required.

```bash
docker-compose up --build
```

What happens automatically:
1. PostgreSQL 16, Redis 7, ZooKeeper, and Kafka start with health-checked readiness.
2. `kafka-init` creates all required Kafka topics.
3. `db-init` runs TypeORM migrations then seeds system permissions, roles, and the super-admin account.
4. The **IAM service** starts on [http://localhost:3000](http://localhost:3000) once the DB is ready.
5. The **IAM Showcase** starts on [http://localhost:3020](http://localhost:3020) once the IAM service is healthy.

| Service | Local URL |
|---------|-----------|
| IAM Service API | http://localhost:3000 |
| IAM Swagger UI | http://localhost:3000/api/docs |
| IAM Health | http://localhost:3000/health/live |
| IAM Showcase | http://localhost:3020 |
| PostgreSQL | localhost:5433 |
| Redis | localhost:6379 |
| Kafka | localhost:9092 |

Default super-admin credentials (see `.env.docker`):
- **Email**: `superadmin@platform.com`
- **Password**: `SuperAdmin123!`

### Tear down
```bash
docker compose down        # stop and remove containers
docker compose down -v     # also delete database and Redis volumes
```

### Rebuild a single service after code changes
```bash
docker compose build iam && docker compose up -d iam
```

---

## Local Development (without Docker app containers)

Use this when you want hot-reload for application code but still need the infrastructure services running.

1. **Clone and install:**
   ```bash
   git clone <repo-url>
   cd IAM
   npm install
   ```

2. **Start infrastructure only:**
   ```bash
   docker compose up -d postgres redis zookeeper kafka
   ```

3. **Copy and edit environment:**
   ```bash
   cp .env.example .env
   # Edit .env — set DB_HOST=localhost, REDIS_HOST=localhost, KAFKA_BROKERS=localhost:9092
   ```

4. **Run migrations and seed:**
   ```bash
   npx typeorm migration:run -d src/database/data-source.ts
   npm run seed
   ```

5. **Start with hot-reload:**
   ```bash
   npm run start:dev
   ```

6. **Start the showcase (separate terminal):**
   ```bash
   cd iam-showcase
   npm install
   IAM_URL=http://localhost:3000 REDIS_URL=redis://localhost:6379 JWT_SECRET=<same-as-env> npm run start:dev
   ```

## API Documentation
Once the server is running, you can access the Swagger UI containing the comprehensive interactive API documentation at:

**[http://localhost:3000/api/docs](http://localhost:3000/api/docs)**

## IAM SDK (`@iam/nestjs-sdk`)
A self-contained NestJS SDK is available under `packages/iam-sdk/`. This SDK includes an `IamAuthzService` and acts as a thin read-only client for permissions checking via Redis cache and IAM HTTP fallbacks.

The repository uses npm workspaces. To build and link the SDK for local development in other microservices:
```bash
npm run build --workspace=@iam/nestjs-sdk
cd packages/iam-sdk && npm link
```
