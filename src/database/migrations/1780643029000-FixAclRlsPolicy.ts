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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS tenant_isolation ON resource_acls`,
    );
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON resource_acls
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    `);
  }
}
