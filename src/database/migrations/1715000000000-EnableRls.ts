import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableRls1715000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'users',
      'roles',
      'user_roles',
      'permissions',
      'role_permissions',
      'acl_entries',
      'user_permission_overrides',
      'audit_logs',
    ];

    for (const table of tables) {
      // Ensure the table exists before altering
      const hasTable = await queryRunner.hasTable(table);
      if (hasTable) {
        await queryRunner.query(
          `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`,
        );
        await queryRunner.query(
          `DROP POLICY IF EXISTS tenant_isolation ON ${table}`,
        );
        await queryRunner.query(`
          CREATE POLICY tenant_isolation ON ${table}
          USING (
            tenant_id = current_setting('app.current_tenant_id', true)::uuid
            OR current_setting('app.current_tenant_id', true) IS NULL
          )
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'users',
      'roles',
      'user_roles',
      'permissions',
      'role_permissions',
      'acl_entries',
      'user_permission_overrides',
      'audit_logs',
    ];

    for (const table of tables) {
      const hasTable = await queryRunner.hasTable(table);
      if (hasTable) {
        await queryRunner.query(
          `DROP POLICY IF EXISTS tenant_isolation ON ${table}`,
        );
        await queryRunner.query(
          `ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`,
        );
      }
    }
  }
}
