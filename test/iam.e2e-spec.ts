/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * IAM Service — Full End-to-End Test Suite
 *
 * SDET Test Plan
 * ─────────────────────────────────────────────────────────────────────────────
 * Coverage:
 *   §1  Health & Observability        (3  tests)
 *   §2  Authentication Flows          (10 tests)
 *   §3  Tenant Management             (7  tests)
 *   §4  User Management               (9  tests)
 *   §5  RBAC — Roles & Permissions    (17 tests)
 *   §6  ACL Management                (6  tests)
 *   §7  Authorization Check (S2S)     (4  tests)
 *   §8  RLS Tenant Isolation          (6  tests)
 *   §9  SuperAdmin APIs               (7  tests)
 *   §10 Audit Log Integrity           (8  tests, Kafka-polled)
 *   §11 Guard & Permission Enforcement(7  tests)
 *
 * Pre-conditions:
 *   - PostgreSQL, Redis, Kafka running (docker-compose up)
 *   - DB seeded: npm run seed
 *   - Test uses JwtService to mint tokens for setup, and real /auth/login
 *     for auth-flow tests.
 *
 * Run: npm run test:e2e -- --testPathPattern=iam.e2e-spec
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { IdentityType } from '../src/common/constants/identity-types.constant';

// ─── constants ────────────────────────────────────────────────────────────────

const P = (path: string) => `/api/v1${path}`;
const TIMEOUT_MS = 60_000;
const AUDIT_POLL_MS = 8_000;

// ─── helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry fn() up to maxMs milliseconds, returning null on timeout. */
async function poll<T>(
  fn: () => Promise<T | null>,
  maxMs = AUDIT_POLL_MS,
  intervalMs = 600,
): Promise<T | null> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const result = await fn();
    if (result !== null && result !== undefined) return result;
    await sleep(intervalMs);
  }
  return null;
}

/**
 * Unwrap the ResponseTransformInterceptor envelope {success, data, meta}.
 * Every IAM success response is wrapped; this gives back just the payload.
 */
const d = (res: any): any => res.body?.data ?? res.body;

/**
 * For endpoints that return a paginated shape {data:[], total, page, limit}
 * (e.g. GET /users), the interceptor double-wraps: body.data.data is the array.
 * For flat-list endpoints (GET /roles, GET /tenants), body.data IS the array.
 */
const items = (res: any): any[] => {
  const payload = d(res);
  return Array.isArray(payload) ? payload : (payload?.data ?? []);
};

// ─── suite ────────────────────────────────────────────────────────────────────

describe('IAM Service — Full E2E Suite', () => {
  let app: any; // INestApplication — typed as any to avoid workspace NestJS version mismatch
  let jwt: JwtService;
  let db: DataSource;

  // ── auth tokens ────────────────────────────────────────────────────────────
  let saToken: string; // SuperAdmin (minted via JwtService)
  let tokenA: string; // Tenant A admin (real JWT from /auth/login)
  let tokenB: string; // Tenant B admin
  let memberToken: string; // Regular MEMBER in Tenant A

  // ── test data handles ──────────────────────────────────────────────────────
  const ts = Date.now();
  const adminEmailA = `admin-a-${ts}@e2e.test`;
  const adminEmailB = `admin-b-${ts}@e2e.test`;
  const memberEmail = `member-${ts}@e2e.test`;
  const adminPass = 'AdminE2e@123';
  const memberPass = 'MemberE2e@123';

  let tenantAId: string;
  let tenantBId: string;
  let adminUserAId: string;
  let adminUserBId: string;
  let memberUserId: string;

  let customRoleId: string;
  let permExpenseReadId: string;
  let permExpenseWriteId: string;
  let permExpenseDeleteId: string;
  let aclId: string;
  let overrideDenyId: string;
  let overrideGrantId: string;

  const testResourceId = `res-e2e-${ts}`;

  // ─── bootstrap ─────────────────────────────────────────────────────────────

  beforeAll(async () => {
    const fixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = fixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    const configService = app.get(require('@nestjs/config').ConfigService);
    app.connectMicroservice({
      transport: require('@nestjs/microservices').Transport.KAFKA,
      options: {
        client: {
          brokers: configService.get('kafka.brokers', ['localhost:9092']),
          clientId: 'iam-e2e-client',
        },
        consumer: {
          groupId: 'iam-audit-consumer-e2e',
        },
      },
    });

    await app.startAllMicroservices();
    await app.init();

    jwt = app.get(JwtService);
    db = app.get(DataSource);

    // SuperAdmin token (bypasses real login; JwtService uses the same secret)
    saToken = jwt.sign({
      sub: '11111111-1111-1111-1111-111111111111',
      email: 'sa@e2e.test',
      identity_type: IdentityType.SUPER_ADMIN,
    });

    // ── create Tenant A ──────────────────────────────────────────────────────
    const resA = await request(app.getHttpServer())
      .post(P('/tenants'))
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        name: `E2E Alpha ${ts}`,
        slug: `e2e-alpha-${ts}`,
        settings: { max_users: 100 },
        admin: {
          email: adminEmailA,
          password: adminPass,
          first_name: 'Admin',
          last_name: 'Alpha',
        },
      });

    expect(resA.status).toBe(201);
    tenantAId = d(resA).id;

    // ── create Tenant B ──────────────────────────────────────────────────────
    const resB = await request(app.getHttpServer())
      .post(P('/tenants'))
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        name: `E2E Beta ${ts}`,
        slug: `e2e-beta-${ts}`,
        settings: { max_users: 100 },
        admin: {
          email: adminEmailB,
          password: adminPass,
          first_name: 'Admin',
          last_name: 'Beta',
        },
      });

    expect(resB.status).toBe(201);
    tenantBId = d(resB).id;

    // ── login as Tenant A admin (real credential flow) ────────────────────────
    const loginA = await request(app.getHttpServer())
      .post(P('/auth/login'))
      .send({ email: adminEmailA, password: adminPass });

    expect(loginA.status).toBe(200);
    tokenA = d(loginA).access_token;

    const meA = await request(app.getHttpServer())
      .get(P('/auth/me'))
      .set('Authorization', `Bearer ${tokenA}`);
    adminUserAId = d(meA).id;

    // ── login as Tenant B admin ───────────────────────────────────────────────
    const loginB = await request(app.getHttpServer())
      .post(P('/auth/login'))
      .send({ email: adminEmailB, password: adminPass });

    expect(loginB.status).toBe(200);
    tokenB = d(loginB).access_token;

    const meB = await request(app.getHttpServer())
      .get(P('/auth/me'))
      .set('Authorization', `Bearer ${tokenB}`);
    adminUserBId = d(meB).id;

    // ── create regular member in Tenant A ────────────────────────────────────
    const memberRes = await request(app.getHttpServer())
      .post(P('/users'))
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        email: memberEmail,
        password: memberPass,
        first_name: 'Member',
        last_name: 'Alpha',
      });

    expect(memberRes.status).toBe(201);
    memberUserId = d(memberRes).id;

    const memberLogin = await request(app.getHttpServer())
      .post(P('/auth/login'))
      .send({ email: memberEmail, password: memberPass });
    memberToken = d(memberLogin).access_token;

    // ── resolve permission IDs ────────────────────────────────────────────────
    const permsRes = await request(app.getHttpServer())
      .get(P('/permissions'))
      .set('Authorization', `Bearer ${tokenA}`);

    const perms: Array<{ id: string; code: string }> = d(permsRes) ?? [];
    permExpenseReadId =
      perms.find((p) => p.code === 'expense.expenses.read')?.id ?? '';
    permExpenseWriteId =
      perms.find((p) => p.code === 'expense.expenses.update')?.id ?? '';
    permExpenseDeleteId =
      perms.find((p) => p.code === 'expense.expenses.delete')?.id ?? '';

    expect(permExpenseReadId).toBeTruthy();
    expect(permExpenseWriteId).toBeTruthy();
    expect(permExpenseDeleteId).toBeTruthy();
  }, TIMEOUT_MS);

  // ─── teardown ──────────────────────────────────────────────────────────────

  afterAll(async () => {
    if (db?.isInitialized) {
      try {
        // Bypass RLS for cleanup — requires BYPASSRLS or superuser privilege
        await db.query(`SET row_security = off`);

        for (const tid of [tenantAId, tenantBId].filter(Boolean)) {
          await db.query(
            `DELETE FROM "user_permission_override" WHERE "tenant_id" = $1`,
            [tid],
          );
          await db.query(
            `DELETE FROM "user_role"               WHERE "tenant_id" = $1`,
            [tid],
          );
          await db.query(
            `DELETE FROM "role_permission"         WHERE "tenant_id" = $1`,
            [tid],
          );
          await db.query(
            `DELETE FROM "resource_acl"            WHERE "tenant_id" = $1`,
            [tid],
          );
          await db.query(
            `DELETE FROM "refresh_token"
             WHERE "user_id" IN (SELECT id FROM "user" WHERE "tenant_id" = $1)`,
            [tid],
          );
          await db.query(`DELETE FROM "user"  WHERE "tenant_id" = $1`, [tid]);
          await db.query(
            `DELETE FROM "role"  WHERE "tenant_id" = $1 AND "is_system" = false`,
            [tid],
          );
          await db.query(`DELETE FROM "tenant" WHERE "id" = $1`, [tid]);
        }

        await db.query(`SET row_security = on`);
      } catch (err) {
        // Non-fatal — test DB may retain data if user lacks BYPASSRLS
        console.warn('[afterAll] Cleanup warning:', (err as Error).message);
      }
    }
    await app?.close();
  }, 30_000);

  // ═══════════════════════════════════════════════════════════════════════════
  // §1. HEALTH & OBSERVABILITY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('§1 Health & Observability', () => {
    it('GET /health → 200', () =>
      request(app.getHttpServer()).get(P('/health')).expect(200));

    it('GET /health/ready → 200, status: ok, all deps up', async () => {
      const res = await request(app.getHttpServer())
        .get(P('/health/ready'))
        .expect(200);
      expect(d(res).status).toBe('ok');
      expect(d(res).info).toBeDefined();
    });

    it('GET /health/live → 200', () =>
      request(app.getHttpServer()).get(P('/health/live')).expect(200));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // §2. AUTHENTICATION FLOWS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('§2 Authentication', () => {
    describe('POST /auth/login', () => {
      it('returns access_token + refresh_token on valid credentials', async () => {
        const res = await request(app.getHttpServer())
          .post(P('/auth/login'))
          .send({ email: adminEmailA, password: adminPass })
          .expect(200);

        expect(d(res).access_token).toBeDefined();
        expect(d(res).refresh_token).toBeDefined();
        expect(d(res).token_type).toBe('Bearer');
        expect(d(res).expires_in).toBeGreaterThan(0);
      });

      it('returns 401 on wrong password', () =>
        request(app.getHttpServer())
          .post(P('/auth/login'))
          .send({ email: adminEmailA, password: 'WrongPass!' })
          .expect(401));

      it('returns 401 on unknown email', () =>
        request(app.getHttpServer())
          .post(P('/auth/login'))
          .send({ email: 'ghost@nowhere.test', password: 'Whatever1!' })
          .expect(401));
    });

    describe('GET /auth/me', () => {
      it('returns current user profile with tenant_id', async () => {
        const res = await request(app.getHttpServer())
          .get(P('/auth/me'))
          .set('Authorization', `Bearer ${tokenA}`)
          .expect(200);

        expect(d(res).id).toBe(adminUserAId);
        expect(d(res).email).toBe(adminEmailA);
        expect(d(res).tenant_id).toBe(tenantAId);
      });

      it('returns 401 without Authorization header', () =>
        request(app.getHttpServer()).get(P('/auth/me')).expect(401));
    });

    describe('POST /auth/refresh (token rotation)', () => {
      it('issues a new token pair; new refresh_token ≠ original', async () => {
        const loginRes = await request(app.getHttpServer())
          .post(P('/auth/login'))
          .send({ email: adminEmailA, password: adminPass })
          .expect(200);

        const original = d(loginRes).refresh_token;

        const refreshRes = await request(app.getHttpServer())
          .post(P('/auth/refresh'))
          .send({ refresh_token: original })
          .expect(200);

        expect(d(refreshRes).access_token).toBeDefined();
        expect(d(refreshRes).refresh_token).not.toBe(original);
      });

      it('rejects a refresh token after it has been rotated (replay prevention)', async () => {
        const loginRes = await request(app.getHttpServer())
          .post(P('/auth/login'))
          .send({ email: adminEmailA, password: adminPass })
          .expect(200);

        const token = d(loginRes).refresh_token;

        // First use — OK
        await request(app.getHttpServer())
          .post(P('/auth/refresh'))
          .send({ refresh_token: token })
          .expect(200);

        // Second use — token rotated, must fail
        await request(app.getHttpServer())
          .post(P('/auth/refresh'))
          .send({ refresh_token: token })
          .expect(401);
      });

      it('rejects a garbage refresh token', () =>
        request(app.getHttpServer())
          .post(P('/auth/refresh'))
          .send({ refresh_token: 'not-a-real-token' })
          .expect(401));
    });

    describe('POST /auth/logout', () => {
      it('revokes refresh token so subsequent refresh returns 401', async () => {
        const loginRes = await request(app.getHttpServer())
          .post(P('/auth/login'))
          .send({ email: adminEmailA, password: adminPass })
          .expect(200);

        const { access_token, refresh_token } = d(loginRes);

        await request(app.getHttpServer())
          .post(P('/auth/logout'))
          .set('Authorization', `Bearer ${access_token}`)
          .expect((res) => expect([200, 204]).toContain(res.status));

        await request(app.getHttpServer())
          .post(P('/auth/refresh'))
          .send({ refresh_token })
          .expect(401);
      });

      it('returns 401 when called without a token', () =>
        request(app.getHttpServer()).post(P('/auth/logout')).expect(401));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // §3. TENANT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('§3 Tenant Management', () => {
    let ephemeralTenantId: string;

    it('POST /tenants → 201 creates tenant + admin (SuperAdmin)', async () => {
      const res = await request(app.getHttpServer())
        .post(P('/tenants'))
        .set('Authorization', `Bearer ${saToken}`)
        .send({
          name: `Ephemeral Tenant ${ts}`,
          slug: `ephemeral-${ts}`,
          admin: {
            email: `eph-${ts}@e2e.test`,
            password: adminPass,
            first_name: 'Eph',
            last_name: 'Admin',
          },
        })
        .expect(201);

      ephemeralTenantId = d(res).id;
      expect(d(res).is_active).toBe(true);
      expect(d(res).slug).toBe(`ephemeral-${ts}`);
    });

    it('POST /tenants → 403 for non-SuperAdmin', () =>
      request(app.getHttpServer())
        .post(P('/tenants'))
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Unauthorised',
          slug: `unauth-${ts}`,
          admin: {
            email: 'x@x.com',
            password: adminPass,
            first_name: 'X',
            last_name: 'X',
          },
        })
        .expect(403));

    it('GET /tenants → 200, SuperAdmin sees all tenants', async () => {
      const res = await request(app.getHttpServer())
        .get(P('/tenants'))
        .set('Authorization', `Bearer ${saToken}`)
        .expect(200);

      const ids = items(res).map((t: any) => t.id);
      expect(ids).toContain(tenantAId);
      expect(ids).toContain(tenantBId);
    });

    it('GET /tenants → 403 for tenant admin', () =>
      request(app.getHttpServer())
        .get(P('/tenants'))
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(403));

    it('GET /tenants/:id → 200 returns correct tenant', async () => {
      const res = await request(app.getHttpServer())
        .get(P(`/tenants/${tenantAId}`))
        .set('Authorization', `Bearer ${saToken}`)
        .expect(200);

      expect(d(res).id).toBe(tenantAId);
    });

    it('PATCH /tenants/:id → 200 updates settings', async () => {
      const res = await request(app.getHttpServer())
        .patch(P(`/tenants/${tenantAId}`))
        .set('Authorization', `Bearer ${saToken}`)
        .send({ name: `E2E Alpha Updated ${ts}`, settings: { max_users: 200 } })
        .expect(200);

      expect(d(res).settings.max_users).toBe(200);
    });

    it('DELETE /tenants/:id → soft-deactivates tenant (is_active → false)', async () => {
      await request(app.getHttpServer())
        .delete(P(`/tenants/${ephemeralTenantId}`))
        .set('Authorization', `Bearer ${saToken}`)
        .expect((res) => expect([200, 204]).toContain(res.status));

      const check = await request(app.getHttpServer())
        .get(P(`/tenants/${ephemeralTenantId}`))
        .set('Authorization', `Bearer ${saToken}`)
        .expect(200);

      expect(d(check).is_active).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // §4. USER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('§4 User Management', () => {
    let statusUserId: string;
    const statusEmail = `status-${ts}@e2e.test`;
    const statusPassword = 'StatusE2e@1';

    it('POST /users → 201 creates user in calling tenant', async () => {
      const res = await request(app.getHttpServer())
        .post(P('/users'))
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          email: statusEmail,
          password: statusPassword,
          first_name: 'Status',
          last_name: 'Tester',
        })
        .expect(201);

      statusUserId = d(res).id;
      expect(d(res).tenant_id).toBe(tenantAId);
      expect(d(res).is_active).toBe(true);
    });

    it('POST /users → 400/409 on duplicate email within same tenant', () =>
      request(app.getHttpServer())
        .post(P('/users'))
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          email: statusEmail,
          password: statusPassword,
          first_name: 'Dup',
          last_name: 'User',
        })
        .expect((res) => expect([400, 409]).toContain(res.status)));

    it('POST /users → 201 respects manager_id for hierarchy', async () => {
      const res = await request(app.getHttpServer())
        .post(P('/users'))
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          email: `sub-${ts}@e2e.test`,
          password: adminPass,
          first_name: 'Sub',
          last_name: 'User',
          manager_id: adminUserAId,
        })
        .expect(201);

      expect(d(res).manager_id).toBe(adminUserAId);
    });

    it('GET /users → 200 paginated, includes all tenant-A users', async () => {
      const res = await request(app.getHttpServer())
        .get(P('/users?page=1&limit=50'))
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const ids = items(res).map((u: any) => u.id);
      expect(ids).toContain(adminUserAId);
      expect(ids).toContain(memberUserId);
    });

    it('GET /users/:id → 200 tenant admin retrieves own-tenant user', async () => {
      const res = await request(app.getHttpServer())
        .get(P(`/users/${memberUserId}`))
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(d(res).id).toBe(memberUserId);
    });

    it('PATCH /users/:id → 200 updates first_name', async () => {
      const res = await request(app.getHttpServer())
        .patch(P(`/users/${memberUserId}`))
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ first_name: 'Updated' })
        .expect(200);

      expect(d(res).first_name).toBe('Updated');
    });

    it('GET /users/:id/hierarchy → 200 returns reporting chain', () =>
      request(app.getHttpServer())
        .get(P(`/users/${adminUserAId}/hierarchy`))
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200));

    describe('PATCH /users/:id/status — deactivate / reactivate', () => {
      it('deactivates user → is_active: false', async () => {
        const res = await request(app.getHttpServer())
          .patch(P(`/users/${statusUserId}/status`))
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ is_active: false })
          .expect(200);

        expect(d(res).success).toBe(true);
      });

      it('deactivated user cannot log in → 401', () =>
        request(app.getHttpServer())
          .post(P('/auth/login'))
          .send({ email: statusEmail, password: statusPassword })
          .expect(401));

      it('reactivates user → is_active: true', async () => {
        const res = await request(app.getHttpServer())
          .patch(P(`/users/${statusUserId}/status`))
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ is_active: true })
          .expect(200);

        expect(d(res).success).toBe(true);
      });

      it('reactivated user can log in again → 200', () =>
        request(app.getHttpServer())
          .post(P('/auth/login'))
          .send({ email: statusEmail, password: statusPassword })
          .expect(200));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // §5. RBAC — Roles, Permissions, Overrides
  // ═══════════════════════════════════════════════════════════════════════════

  describe('§5 RBAC', () => {
    describe('GET /permissions', () => {
      it('lists all system permissions with code + id', async () => {
        const res = await request(app.getHttpServer())
          .get(P('/permissions'))
          .set('Authorization', `Bearer ${tokenA}`)
          .expect(200);

        expect(Array.isArray(d(res))).toBe(true);
        expect(d(res).length).toBeGreaterThan(0);
        const codes: string[] = d(res).map((p: any) => p.code);
        expect(codes).toContain('expense.expenses.read');
        expect(codes).toContain('expense.expenses.update');
      });
    });

    describe('Role CRUD', () => {
      it('POST /roles → 201, creates custom (non-system) role', async () => {
        const res = await request(app.getHttpServer())
          .post(P('/roles'))
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ name: `E2E Finance ${ts}`, description: 'E2E finance role' })
          .expect(201);

        customRoleId = d(res).id;
        expect(d(res).is_system).toBe(false);
        expect(d(res).tenant_id).toBe(tenantAId);
      });

      it('GET /roles → 200, includes system roles and the custom role', async () => {
        const res = await request(app.getHttpServer())
          .get(P('/roles'))
          .set('Authorization', `Bearer ${tokenA}`)
          .expect(200);

        const ids = items(res).map((r: any) => r.id);
        expect(ids).toContain(customRoleId);
        expect(items(res).some((r: any) => r.is_system === true)).toBe(true);
      });

      it('GET /roles/:id → 200', () =>
        request(app.getHttpServer())
          .get(P(`/roles/${customRoleId}`))
          .set('Authorization', `Bearer ${tokenA}`)
          .expect(200));

      it('PATCH /roles/:id → 200 updates name', async () => {
        const res = await request(app.getHttpServer())
          .patch(P(`/roles/${customRoleId}`))
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ name: `E2E Finance V2 ${ts}` })
          .expect(200);

        expect(d(res).name).toBe(`E2E Finance V2 ${ts}`);
      });
    });

    describe('Permission assignment to role', () => {
      it('PATCH /roles/:id/permissions → adds expense:read, expense:write, expense:delete', () =>
        request(app.getHttpServer())
          .patch(P(`/roles/${customRoleId}/permissions`))
          .set('Authorization', `Bearer ${tokenA}`)
          .send({
            add: [permExpenseReadId, permExpenseWriteId, permExpenseDeleteId],
            remove: [],
          })
          .expect(200));

      it('PATCH /roles/:id/permissions → removes expense:delete (batch remove)', () =>
        request(app.getHttpServer())
          .patch(P(`/roles/${customRoleId}/permissions`))
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ add: [], remove: [permExpenseDeleteId] })
          .expect(200));
    });

    describe('Role assignment to user', () => {
      it('PATCH /users/:id/roles → assigns custom role to member', () =>
        request(app.getHttpServer())
          .patch(P(`/users/${memberUserId}/roles`))
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ add: [{ role_id: customRoleId }], remove: [] })
          .expect(200));

      it('GET /users/:id/roles → lists the assigned role', async () => {
        const res = await request(app.getHttpServer())
          .get(P(`/users/${memberUserId}/roles`))
          .set('Authorization', `Bearer ${tokenA}`)
          .expect(200);

        const roleIds = items(res).map((r: any) => r.role_id ?? r.id);
        expect(roleIds).toContain(customRoleId);
      });

      it('GET /users/:id/effective-permissions → expense:read ✓, expense:write ✓, expense:delete ✗', async () => {
        const res = await request(app.getHttpServer())
          .get(P(`/users/${memberUserId}/effective-permissions`))
          .set('Authorization', `Bearer ${tokenA}`)
          .expect(200);

        const perms: string[] = items(res).map((p: any) => p.code ?? p);
        expect(perms).toContain('expense.expenses.read');
        expect(perms).toContain('expense.expenses.update');
        expect(perms).not.toContain('expense.expenses.delete'); // was removed from role
      });
    });

    describe('Permission overrides', () => {
      it('POST .../permission-overrides → 201 DENY expense:write', async () => {
        const res = await request(app.getHttpServer())
          .post(P(`/users/${memberUserId}/permission-overrides`))
          .set('Authorization', `Bearer ${tokenA}`)
          .send({
            permission_id: permExpenseWriteId,
            override_type: 'DENY',
            reason: 'E2E DENY',
          })
          .expect(201);

        overrideDenyId = d(res).id;
        expect(overrideDenyId).toBeDefined();
      });

      it('effective-permissions after DENY: expense:write ✗', async () => {
        const res = await request(app.getHttpServer())
          .get(P(`/users/${memberUserId}/effective-permissions`))
          .set('Authorization', `Bearer ${tokenA}`)
          .expect(200);

        const perms: string[] = items(res).map((p: any) => p.code ?? p);
        expect(perms).toContain('expense.expenses.read');
        expect(perms).not.toContain('expense.expenses.update');
      });

      it('POST .../permission-overrides → 201 GRANT expense:delete (not in role)', async () => {
        const res = await request(app.getHttpServer())
          .post(P(`/users/${memberUserId}/permission-overrides`))
          .set('Authorization', `Bearer ${tokenA}`)
          .send({
            permission_id: permExpenseDeleteId,
            override_type: 'GRANT',
            reason: 'E2E GRANT',
          })
          .expect(201);

        overrideGrantId = d(res).id;
        expect(overrideGrantId).toBeDefined();
      });

      it('effective-permissions after GRANT: expense:delete ✓', async () => {
        const res = await request(app.getHttpServer())
          .get(P(`/users/${memberUserId}/effective-permissions`))
          .set('Authorization', `Bearer ${tokenA}`)
          .expect(200);

        const perms: string[] = items(res).map((p: any) => p.code ?? p);
        expect(perms).toContain('expense.expenses.delete');
      });

      it('GET .../permission-overrides → lists both overrides', async () => {
        const res = await request(app.getHttpServer())
          .get(P(`/users/${memberUserId}/permission-overrides`))
          .set('Authorization', `Bearer ${tokenA}`)
          .expect(200);

        const ids = items(res).map((o: any) => o.id);
        expect(ids).toContain(overrideDenyId);
        expect(ids).toContain(overrideGrantId);
      });

      it('DELETE .../permission-overrides/:id removes the DENY override', () =>
        request(app.getHttpServer())
          .delete(
            P(`/users/${memberUserId}/permission-overrides/${overrideDenyId}`),
          )
          .set('Authorization', `Bearer ${tokenA}`)
          .expect((res) => expect([200, 204]).toContain(res.status)));

      it('effective-permissions after DENY removal: expense:write ✓ again', async () => {
        const res = await request(app.getHttpServer())
          .get(P(`/users/${memberUserId}/effective-permissions`))
          .set('Authorization', `Bearer ${tokenA}`)
          .expect(200);

        const perms: string[] = items(res).map((p: any) => p.code ?? p);
        expect(perms).toContain('expense.expenses.update');
      });
    });

    describe('Role deletion', () => {
      it('DELETE /roles/:id removes a custom role', async () => {
        const tmp = await request(app.getHttpServer())
          .post(P('/roles'))
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ name: `Tmp Role ${ts}`, description: 'disposable' })
          .expect(201);

        const tmpId = d(tmp).id;
        await request(app.getHttpServer())
          .delete(P(`/roles/${tmpId}`))
          .set('Authorization', `Bearer ${tokenA}`)
          .expect((res) => expect([200, 204]).toContain(res.status));

        await request(app.getHttpServer())
          .get(P(`/roles/${tmpId}`))
          .set('Authorization', `Bearer ${tokenA}`)
          .expect(404);
      });

      it('DELETE /roles/:id → 400/403 cannot delete a system role', async () => {
        const rolesRes = await request(app.getHttpServer())
          .get(P('/roles'))
          .set('Authorization', `Bearer ${tokenA}`)
          .expect(200);

        const sys = items(rolesRes).find((r: any) => r.is_system === true);
        expect(sys).toBeDefined();

        await request(app.getHttpServer())
          .delete(P(`/roles/${sys.id}`))
          .set('Authorization', `Bearer ${tokenA}`)
          .expect((res) => expect([400, 403, 422]).toContain(res.status));
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // §6. ACL MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('§6 ACL Management', () => {
    it('POST /acl → 201 creates resource ACL entry', async () => {
      const res = await request(app.getHttpServer())
        .post(P('/acl'))
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          user_id: memberUserId,
          resource_type: 'expense',
          resource_id: testResourceId,
          permission: 'approve',
        })
        .expect(201);

      aclId = d(res).id;
      expect(d(res).resource_id).toBe(testResourceId);
      expect(d(res).permission).toBe('approve');
    });

    it('GET /acl → 200 filterable; includes the ACL entry', async () => {
      const res = await request(app.getHttpServer())
        .get(P(`/acl?resource_type=expense&resource_id=${testResourceId}`))
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const ids = items(res).map((a: any) => a.id);
      expect(ids).toContain(aclId);
    });

    it('POST /acl/check → allowed: true for correct user + resource + permission', async () => {
      const res = await request(app.getHttpServer())
        .post(P('/acl/check'))
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          user_id: memberUserId,
          resource_type: 'expense',
          resource_id: testResourceId,
          permission: 'approve',
        })
        .expect(200);

      expect(d(res).allowed).toBe(true);
      expect(d(res).source).toBe('db');
    });

    it('POST /acl/check → allowed: false for wrong permission on same resource', async () => {
      const res = await request(app.getHttpServer())
        .post(P('/acl/check'))
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          user_id: memberUserId,
          resource_type: 'expense',
          resource_id: testResourceId,
          permission: 'delete',
        })
        .expect(200);

      expect(d(res).allowed).toBe(false);
    });

    it('DELETE /acl/:id removes the ACL entry', () =>
      request(app.getHttpServer())
        .delete(P(`/acl/${aclId}`))
        .set('Authorization', `Bearer ${tokenA}`)
        .expect((res) => expect([200, 204]).toContain(res.status)));

    it('POST /acl/check → allowed: false after deletion', async () => {
      const res = await request(app.getHttpServer())
        .post(P('/acl/check'))
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          user_id: memberUserId,
          resource_type: 'expense',
          resource_id: testResourceId,
          permission: 'approve',
        })
        .expect(200);

      expect(d(res).allowed).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // §7. AUTHORIZATION CHECK (S2S)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('§7 Authorization Check (S2S)', () => {
    it('POST /authorization/check → allowed: true via RBAC for expense:read', async () => {
      const res = await request(app.getHttpServer())
        .post(P('/authorization/check'))
        .send({
          user_id: memberUserId,
          tenant_id: tenantAId,
          permission: 'expense.expenses.read',
        })
        .expect(200);

      expect(d(res).allowed).toBe(true);
      expect(d(res).source).toBe('rbac');
    });

    it('POST /authorization/check → allowed: false for payroll:write (no permission)', async () => {
      const res = await request(app.getHttpServer())
        .post(P('/authorization/check'))
        .send({
          user_id: memberUserId,
          tenant_id: tenantAId,
          permission: 'payroll.write',
        })
        .expect(200);

      expect(d(res).allowed).toBe(false);
    });

    it('POST /authorization/check → allowed: true via ACL for resource-scoped permission', async () => {
      // Seed a resource ACL using the full permission code so the service can match it
      await request(app.getHttpServer())
        .post(P('/acl'))
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          user_id: memberUserId,
          resource_type: 'expense',
          resource_id: testResourceId,
          permission: 'approve',
        });

      const res = await request(app.getHttpServer())
        .post(P('/authorization/check'))
        .send({
          user_id: memberUserId,
          tenant_id: tenantAId,
          permission: 'approve',
          resource_type: 'expense',
          resource_id: testResourceId,
        })
        .expect(200);

      expect(d(res).allowed).toBe(true);
    });

    it('POST /authorization/check-batch → per-check results', async () => {
      const res = await request(app.getHttpServer())
        .post(P('/authorization/check-batch'))
        .send({
          checks: [
            {
              user_id: memberUserId,
              tenant_id: tenantAId,
              permission: 'expense.expenses.read',
            },
            {
              user_id: memberUserId,
              tenant_id: tenantAId,
              permission: 'payroll.write',
            },
          ],
        })
        .expect(200);

      const results: any[] = d(res)?.results ?? d(res) ?? [];
      expect(results).toHaveLength(2);

      const readResult = results[0];
      const payrollResult = results[1];
      expect(readResult?.allowed).toBe(true);
      expect(payrollResult?.allowed).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // §8. RLS TENANT ISOLATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('§8 RLS Tenant Isolation', () => {
    it('Tenant B admin cannot GET Tenant A user by ID → 404', () =>
      request(app.getHttpServer())
        .get(P(`/users/${memberUserId}`))
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404));

    it('Tenant B admin GET /users does not see Tenant A users', async () => {
      const res = await request(app.getHttpServer())
        .get(P('/users?limit=100'))
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      const ids = items(res).map((u: any) => u.id);
      expect(ids).not.toContain(memberUserId);
      expect(ids).not.toContain(adminUserAId);
    });

    it('Tenant B admin GET /roles does not see Tenant A custom role', async () => {
      const res = await request(app.getHttpServer())
        .get(P('/roles'))
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      const ids = items(res).map((r: any) => r.id);
      expect(ids).not.toContain(customRoleId);
    });

    it('Tenant B admin GET /acl does not see Tenant A ACL entries', async () => {
      // seed a fresh ACL in Tenant A
      const a = await request(app.getHttpServer())
        .post(P('/acl'))
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          user_id: memberUserId,
          resource_type: 'expense',
          resource_id: testResourceId,
          permission: 'read',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(P('/acl'))
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      const ids = items(res).map((x: any) => x.id);
      expect(ids).not.toContain(d(a).id);
    });

    it('Tenant B admin PATCH on Tenant A role → 403 or 404', () =>
      request(app.getHttpServer())
        .patch(P(`/roles/${customRoleId}`))
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Cross-Tenant Attack' })
        .expect((res) => expect([403, 404]).toContain(res.status)));

    it('SuperAdmin /super-admin/tenants/:id/users sees users of any tenant', async () => {
      const resA = await request(app.getHttpServer())
        .get(P(`/super-admin/tenants/${tenantAId}/users`))
        .set('Authorization', `Bearer ${saToken}`)
        .expect(200);

      const idsA = items(resA).map((u: any) => u.id);
      expect(idsA).toContain(adminUserAId);

      const resB = await request(app.getHttpServer())
        .get(P(`/super-admin/tenants/${tenantBId}/users`))
        .set('Authorization', `Bearer ${saToken}`)
        .expect(200);

      const idsB = items(resB).map((u: any) => u.id);
      expect(idsB).toContain(adminUserBId);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // §9. SUPERADMIN APIs
  // ═══════════════════════════════════════════════════════════════════════════

  describe('§9 SuperAdmin APIs', () => {
    let impersonationToken: string;

    it('GET /super-admin/tenants → 200 lists all tenants', async () => {
      const res = await request(app.getHttpServer())
        .get(P('/super-admin/tenants?limit=100'))
        .set('Authorization', `Bearer ${saToken}`)
        .expect(200);

      const ids = items(res).map((t: any) => t.id);
      expect(ids).toContain(tenantAId);
      expect(ids).toContain(tenantBId);
    });

    it('GET /super-admin/tenants → 403 for tenant admin', () =>
      request(app.getHttpServer())
        .get(P('/super-admin/tenants'))
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(403));

    it('GET /super-admin/tenants/:id/users → 200 returns tenant users', async () => {
      const res = await request(app.getHttpServer())
        .get(P(`/super-admin/tenants/${tenantAId}/users`))
        .set('Authorization', `Bearer ${saToken}`)
        .expect(200);

      expect(items(res).length).toBeGreaterThan(0);
    });

    it('GET /super-admin/audit-logs → 200 paginated', () =>
      request(app.getHttpServer())
        .get(P('/super-admin/audit-logs?page=1&limit=10'))
        .set('Authorization', `Bearer ${saToken}`)
        .expect(200));

    it('POST /super-admin/impersonate → 200 returns impersonation token', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const res = await request(app.getHttpServer())
        .post(P('/super-admin/impersonate'))
        .set('Authorization', `Bearer ${saToken}`)
        .send({
          user_id: memberUserId,
          tenant_id: tenantAId,
          reason: 'E2E impersonation test',
        })
        .expect(200);

      impersonationToken = d(res).access_token;
      expect(impersonationToken).toBeDefined();
      expect(d(res).expires_in).toBeGreaterThan(0);
    });

    it('impersonation token payload has identity_type: IMPERSONATION', () => {
      const payload = JSON.parse(
        Buffer.from(impersonationToken.split('.')[1], 'base64url').toString(),
      );
      expect(payload.identity_type).toBe('IMPERSONATION');
      expect(payload.sub).toBe(memberUserId);
      expect(payload.tenant_id).toBe(tenantAId);
      expect(payload.impersonator_id).toBeDefined();
    });

    it('impersonation token can call /auth/me and returns the target user', async () => {
      const res = await request(app.getHttpServer())
        .get(P('/auth/me'))
        .set('Authorization', `Bearer ${impersonationToken}`)
        .expect(200);

      expect(d(res).id).toBe(memberUserId);
    });

    it('POST /super-admin/impersonate → 404 for non-existent user', () =>
      request(app.getHttpServer())
        .post(P('/super-admin/impersonate'))
        .set('Authorization', `Bearer ${saToken}`)
        .send({
          user_id: '00000000-0000-0000-0000-000000000000',
          tenant_id: tenantAId,
          reason: 'ghost',
        })
        .expect(404));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // §10. AUDIT LOG INTEGRITY  (events travel Kafka → consumer → audit_logs)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('§10 Audit Log Integrity', () => {
    /** Poll audit_logs table by event_type and optional tenant_id */
    async function findAudit(eventType: string, tenantId?: string) {
      return poll(async () => {
        const params: any[] = [eventType];
        let query = `SELECT * FROM "audit_logs" WHERE "event_type" = $1`;
        if (tenantId) {
          query += ` AND "tenant_id" = $2`;
          params.push(tenantId);
        }
        query += ` ORDER BY "created_at" DESC LIMIT 1`;
        const rows = await db.query(query, params);
        return rows.length > 0 ? rows[0] : null;
      });
    }

    it('AUTH_LOGIN_SUCCESS recorded after login', async () => {
      await request(app.getHttpServer())
        .post(P('/auth/login'))
        .send({ email: adminEmailA, password: adminPass });

      const log = await findAudit('AUTH_LOGIN_SUCCESS');
      expect(log).not.toBeNull();
    }, 15_000);

    it('AUTH_LOGIN_FAILED recorded after failed login', async () => {
      await request(app.getHttpServer())
        .post(P('/auth/login'))
        .send({ email: adminEmailA, password: 'BadPass!!' });

      const log = await findAudit('AUTH_LOGIN_FAILED');
      expect(log).not.toBeNull();
    }, 15_000);

    it('TENANT_CREATED recorded for Tenant A', async () => {
      const log = await findAudit('TENANT_CREATED', tenantAId);
      expect(log).not.toBeNull();
    }, 15_000);

    it('USER_CREATED recorded in Tenant A', async () => {
      const log = await findAudit('USER_CREATED', tenantAId);
      expect(log).not.toBeNull();
    }, 15_000);

    it('ROLE_CREATED recorded in Tenant A', async () => {
      const log = await findAudit('ROLE_CREATED', tenantAId);
      expect(log).not.toBeNull();
    }, 15_000);

    it('ROLE_ASSIGNED recorded after role assignment', async () => {
      const log = await findAudit('ROLE_ASSIGNED', tenantAId);
      expect(log).not.toBeNull();
    }, 15_000);

    it('ACL_CREATED recorded after ACL entry creation', async () => {
      const log = await findAudit('ACL_CREATED', tenantAId);
      expect(log).not.toBeNull();
    }, 15_000);

    it('IMPERSONATION_STARTED recorded', async () => {
      const log = await findAudit('IMPERSONATION_STARTED');
      expect(log).not.toBeNull();
    }, 15_000);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // §11. GUARD & PERMISSION ENFORCEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('§11 Guard & Permission Enforcement', () => {
    const protectedEndpoints = [
      ['get', '/users'],
      ['get', '/roles'],
      ['get', '/permissions'],
      ['get', '/acl'],
      ['get', '/auth/me'],
    ] as const;

    protectedEndpoints.forEach(([method, path]) => {
      it(`${method.toUpperCase()} ${path} → 401 without Authorization header`, () =>
        (request(app.getHttpServer()) as any)[method](P(path)).expect(401));
    });

    it('tampered / malformed JWT → 401', () =>
      request(app.getHttpServer())
        .get(P('/users'))
        .set(
          'Authorization',
          'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlIn0.bad',
        )
        .expect(401));

    it('MEMBER role → 403 on POST /roles (requires role:write)', async () => {
      const res = await request(app.getHttpServer())
        .post(P('/roles'))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Forbidden Role', description: 'nope' });
      expect(res.status).toBe(403);
    });

    it('Tenant Admin → 403 on SuperAdmin-only POST /super-admin/impersonate', () =>
      request(app.getHttpServer())
        .post(P('/super-admin/impersonate'))
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ user_id: memberUserId, tenant_id: tenantAId, reason: 'test' })
        .expect(403));

    it('Tenant Admin → 403 on GET /super-admin/tenants', () =>
      request(app.getHttpServer())
        .get(P('/super-admin/tenants'))
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(403));
  });
});
