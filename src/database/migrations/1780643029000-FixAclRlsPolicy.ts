import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixAclRlsPolicy1780643029000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS tenant_isolation ON resource_acls`,
    );
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON resource_acls
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    `);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO iam_superadmin;`,
    );
    await queryRunner.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO iam_superadmin;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS tenant_isolation ON resource_acls`,
    );
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON resource_acls
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    `);
    await queryRunner.query(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM iam_superadmin;`,
    );
    await queryRunner.query(
      `REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public FROM iam_superadmin;`,
    );
  }
}

