import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableRLS1780599504679 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create superadmin and tenant user roles
    await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'iam_superadmin') THEN
                    CREATE ROLE iam_superadmin BYPASSRLS;
                END IF;
                IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'iam_tenant_user') THEN
                    CREATE ROLE iam_tenant_user;
                END IF;
            END $$;
        `);

    await queryRunner.query(`GRANT iam_superadmin TO iam_app;`);
    await queryRunner.query(`GRANT iam_tenant_user TO iam_app;`);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO iam_tenant_user;`,
    );
    await queryRunner.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO iam_tenant_user;`,
    );

    // Enable RLS
    const tables = [
      'users',
      'roles',
      'user_roles',
      'role_permissions',
      'resource_acls',
      'user_permission_overrides',
      'audit_logs',
    ];
    for (const table of tables) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`,
      ); // Ensure owner also respects it unless bypassed
    }

    // Policies
    await queryRunner.query(`
            CREATE POLICY tenant_isolation ON users
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        `);

    await queryRunner.query(`
            CREATE POLICY tenant_isolation ON roles
            USING (is_system = true OR tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        `);

    await queryRunner.query(`
            CREATE POLICY tenant_isolation ON user_roles
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        `);

    await queryRunner.query(`
            CREATE POLICY tenant_isolation ON role_permissions
            USING (
                role_id IN (
                    SELECT id FROM roles 
                    WHERE is_system = true OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
                )
            );
        `);

    await queryRunner.query(`
            CREATE POLICY tenant_isolation ON resource_acls
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        `);

    await queryRunner.query(`
            CREATE POLICY tenant_isolation ON user_permission_overrides
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        `);

    await queryRunner.query(`
            CREATE POLICY tenant_isolation ON audit_logs
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid OR tenant_id IS NULL);
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'users',
      'roles',
      'user_roles',
      'role_permissions',
      'resource_acls',
      'user_permission_overrides',
      'audit_logs',
    ];

    for (const table of tables) {
      await queryRunner.query(
        `DROP POLICY IF EXISTS tenant_isolation ON "${table}";`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY;`,
      );
    }

    await queryRunner.query(`DROP ROLE IF EXISTS iam_superadmin;`);
    await queryRunner.query(`DROP ROLE IF EXISTS iam_tenant_user;`);
  }
}
