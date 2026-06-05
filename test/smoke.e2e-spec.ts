import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { IdentityType } from '../src/common/constants/identity-types.constant';

describe('IAM Services Smoke Test (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let dataSource: DataSource;

  // Tokens
  let superAdminToken: string;
  let tenantAAdminToken: string;
  let tenantBAdminToken: string;

  // IDs
  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;
  let userBId: string;
  let roleAId: string;
  let aclAId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    jwtService = app.get(JwtService);
    dataSource = app.get(DataSource);

    // Generate SuperAdmin Token (no tenant boundaries)
    superAdminToken = jwtService.sign({
      sub: 'super-admin-id-123',
      email: 'superadmin@example.com',
      identity_type: IdentityType.SUPER_ADMIN,
    });
  });

  afterAll(async () => {
    // // Clean up created test entities to keep database clean
    // try {
    //   if (tenantAId) {
    //     await dataSource.query(`DELETE FROM "user_permission_override" WHERE "tenant_id" IN ($1, $2)`, [tenantAId, tenantBId]);
    //     await dataSource.query(`DELETE FROM "user_role" WHERE "tenant_id" IN ($1, $2)`, [tenantAId, tenantBId]);
    //     await dataSource.query(`DELETE FROM "role_permission" WHERE "tenant_id" IN ($1, $2)`, [tenantAId, tenantBId]);
    //     await dataSource.query(`DELETE FROM "resource_acl" WHERE "tenant_id" IN ($1, $2)`, [tenantAId, tenantBId]);
    //     await dataSource.query(`DELETE FROM "user" WHERE "tenant_id" IN ($1, $2)`, [tenantAId, tenantBId]);
    //     await dataSource.query(`DELETE FROM "role" WHERE "tenant_id" IN ($1, $2)`, [tenantAId, tenantBId]);
    //     await dataSource.query(`DELETE FROM "tenant" WHERE "id" IN ($1, $2)`, [tenantAId, tenantBId]);
    //   }
    // } catch (err) {
    //   console.warn('Cleanup failed (expected if DB was clean):', err.message);
    // }
    await app.close();
  });

  describe('1. SuperAdmin Flows', () => {
    it('should create Tenant A and Tenant B as SuperAdmin', async () => {
      const resA = await request(app.getHttpServer())
        .post('/tenants')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: `Smoke Tenant A ${Date.now()}`,
        })
        .expect(201);

      tenantAId = resA.body.id;
      expect(tenantAId).toBeDefined();

      const resB = await request(app.getHttpServer())
        .post('/tenants')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: `Smoke Tenant B ${Date.now()}`,
        })
        .expect(201);

      tenantBId = resB.body.id;
      expect(tenantBId).toBeDefined();
    });

    it('should create users inside Tenant A and Tenant B', async () => {
      const resUserA = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          email: `usera_${Date.now()}@tenanta.com`,
          first_name: 'Tenant A',
          last_name: 'User',
          tenant_id: tenantAId,
          password: 'Password123!',
        })
        .expect(201);

      userAId = resUserA.body.id;
      expect(userAId).toBeDefined();

      const resUserB = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          email: `userb_${Date.now()}@tenantb.com`,
          first_name: 'Tenant B',
          last_name: 'User',
          tenant_id: tenantBId,
          password: 'Password123!',
        })
        .expect(201);

      userBId = resUserB.body.id;
      expect(userBId).toBeDefined();

      // Sign tokens for these users to perform tenant-scoped requests
      tenantAAdminToken = jwtService.sign({
        sub: userAId,
        email: resUserA.body.email,
        tenant_id: tenantAId,
        identity_type: IdentityType.USER,
      });

      tenantBAdminToken = jwtService.sign({
        sub: userBId,
        email: resUserB.body.email,
        tenant_id: tenantBId,
        identity_type: IdentityType.USER,
      });
    });
  });

  describe('2. RBAC & ACL Creation Validation', () => {
    it('should allow Tenant A User to create a Role', async () => {
      const res = await request(app.getHttpServer())
        .post('/roles')
        .set('Authorization', `Bearer ${tenantAAdminToken}`)
        .send({
          name: 'Manager',
          description: 'Tenant A Manager Role',
        })
        .expect(201);

      roleAId = res.body.id;
      expect(roleAId).toBeDefined();
    });

    it('should assign permissions to Role in Tenant A', async () => {
      await request(app.getHttpServer())
        .patch(`/roles/${roleAId}/permissions`)
        .set('Authorization', `Bearer ${tenantAAdminToken}`)
        .send({
          permissions: ['expense.read', 'expense.create'],
        })
        .expect(200);
    });

    it('should assign Role to User A', async () => {
      await request(app.getHttpServer())
        .patch(`/users/${userAId}/roles`)
        .set('Authorization', `Bearer ${tenantAAdminToken}`)
        .send({
          add: [{ role_id: roleAId }],
        })
        .expect(200);
    });

    it('should create an ACL record for User A', async () => {
      const res = await request(app.getHttpServer())
        .post('/acl')
        .set('Authorization', `Bearer ${tenantAAdminToken}`)
        .send({
          resource: 'department',
          action: 'approve',
          resource_id: 'dept-finance',
          user_id: userAId,
        })
        .expect(201);

      aclAId = res.body.id;
      expect(aclAId).toBeDefined();
    });

    it('should evaluate ACL checks correctly', async () => {
      const res = await request(app.getHttpServer())
        .post('/acl/check')
        .set('Authorization', `Bearer ${tenantAAdminToken}`)
        .send({
          resource: 'department',
          action: 'approve',
          resource_id: 'dept-finance',
        })
        .expect(200);

      expect(res.body.allowed).toBe(true);
    });
  });

  describe('3. RLS Tenant Isolation Checks', () => {
    it('should NOT allow Tenant B User to access Tenant A User (RLS User isolation)', async () => {
      await request(app.getHttpServer())
        .get(`/users/${userAId}`)
        .set('Authorization', `Bearer ${tenantBAdminToken}`)
        .expect(404); // RLS scopes out Tenant A users, making them invisible (NotFound) to Tenant B
    });

    it('should NOT allow Tenant B User to fetch Tenant A Roles', async () => {
      const res = await request(app.getHttpServer())
        .get('/roles')
        .set('Authorization', `Bearer ${tenantBAdminToken}`)
        .expect(200);

      // Should not see Role A (Tenant A Role)
      const hasRoleA = res.body.some((r: any) => r.id === roleAId);
      expect(hasRoleA).toBe(false);
    });

    it('should NOT allow Tenant B User to query Tenant A ACLs', async () => {
      const res = await request(app.getHttpServer())
        .get('/acl')
        .set('Authorization', `Bearer ${tenantBAdminToken}`)
        .expect(200);

      // Should not see ACL A (Tenant A ACL)
      const hasAclA = res.body.some((a: any) => a.id === aclAId);
      expect(hasAclA).toBe(false);
    });
  });
});
