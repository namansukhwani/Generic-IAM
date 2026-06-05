import { DataSource } from 'typeorm';
import { UserRoleEntity } from './src/modules/rbac/entities/user-role.entity';
import { RolePermissionEntity } from './src/modules/rbac/entities/role-permission.entity';
import databaseConfig from './src/config/database.config';

async function run() {
  const ds = new DataSource({
    type: 'postgres',
    url: 'postgresql://postgres:postgres@localhost:5432/iam_test',
    entities: ['./src/**/*.entity.ts'],
  });
  await ds.initialize();
  const res = await ds.query(`
    SELECT u.email, r.name as role_name, p.code as permission_code
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE p.code = 'role.write'
  `);
  console.log(res);
  await ds.destroy();
}
run();
