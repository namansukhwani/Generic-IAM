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
- Node.js >= 20.x
- Docker and Docker Compose
- PostgreSQL 16
- Redis 7
- Kafka / Zookeeper

## Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd IAM
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the infrastructure services (PostgreSQL, Redis, Kafka, Zookeeper):**
   ```bash
   docker-compose up -d postgres redis zookeeper kafka
   ```

4. **Environment Configuration:**
   Create a `.env` file in the root based on `.env.example` (or configure via your environment):
   ```env
   NODE_ENV=development
   PORT=3000
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=iam_app
   DB_PASSWORD=devpassword
   DB_DATABASE=iam
   REDIS_HOST=localhost
   REDIS_PORT=6379
   KAFKA_BROKER=localhost:9092
   JWT_SECRET=supersecretjwtkey
   SUPER_ADMIN_EMAIL=superadmin@example.com
   SUPER_ADMIN_PASSWORD=SuperSecretPassword123!
   ```

5. **Run the Database Migrations / Sync (Ensure `synchronize: true` for dev, false for prod).**

6. **Seed the Database:**
   Populate system permissions, system roles, and the initial SuperAdmin user.
   ```bash
   npm run seed
   ```

7. **Start the application:**
   ```bash
   npm run start:dev
   ```

8. **Alternatively, run everything via Docker Compose:**
   ```bash
   docker-compose up --build
   ```

## API Documentation
Once the server is running, you can access the Swagger UI containing the comprehensive interactive API documentation at:

**[http://localhost:3000/api/docs](http://localhost:3000/api/docs)**

## IAM SDK (`@iam/nestjs-sdk`)
A self-contained NestJS SDK is available under `packages/iam-sdk/`. This SDK includes Guards (`@UseGuards(PermissionGuard)`), Decorators (`@RequirePermissions('expense:read')`), and the `IamClientService` to facilitate integrating IAM checks seamlessly into other microservices.

Build the SDK:
```bash
cd packages/iam-sdk
npm install
npm run build
```
