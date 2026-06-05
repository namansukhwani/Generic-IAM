import { DataSource, IsNull } from 'typeorm';
import { RoleEntity } from '../../modules/rbac/entities/role.entity';
import { PermissionEntity } from '../../modules/rbac/entities/permission.entity';
import { RolePermissionEntity } from '../../modules/rbac/entities/role-permission.entity';

export async function seedRoles(dataSource: DataSource) {
  const roleRepo = dataSource.getRepository(RoleEntity);
  const permissionRepo = dataSource.getRepository(PermissionEntity);
  const rolePermissionRepo = dataSource.getRepository(RolePermissionEntity);

  const rolesData = [
    {
      name: 'Super Admin',
      description: 'System-wide super administrator',
      permissions: ['*:*'],
    },
    {
      name: 'Tenant Admin',
      description: 'Full access to tenant resources',
      permissions: [
        'user:*',
        'role:*',
        'acl:*',
        'expense:*',
        'payroll:*',
        'invoice:*',
        'report:*',
        'workflow:*',
        'notification:*',
      ], // We will map these to specific resource:action in loop since we didn't define resource:* above
    },
    {
      name: 'Auditor',
      description: 'Read-only access to audit logs and reports',
      permissions: [
        'audit:read',
        'report:read',
        'expense:read',
        'payroll:read',
        'invoice:read',
      ],
    },
    {
      name: 'Employee',
      description: 'Basic employee access',
      permissions: ['expense:read', 'expense:write', 'payroll:read'],
    },
    {
      name: 'Manager',
      description: 'Managerial access for approvals',
      permissions: [
        'expense:read',
        'expense:approve',
        'payroll:read',
        'report:read',
      ],
    },
    {
      name: 'Billing Manager',
      description: 'Access to invoices and billing',
      permissions: [
        'invoice:read',
        'invoice:write',
        'invoice:approve',
        'report:read',
        'report:export',
      ],
    },
  ];

  // Helper to resolve permissions
  const allPerms = await permissionRepo.find();

  for (const roleDef of rolesData) {
    let existingRole = await roleRepo.findOne({
      where: { name: roleDef.name, is_system: true, tenant_id: IsNull() },
    });

    if (!existingRole) {
      existingRole = roleRepo.create({
        name: roleDef.name,
        description: roleDef.description,
        is_system: true,
        tenant_id: null,
      });
      await roleRepo.save(existingRole);
    }

    // Assign permissions
    const permissionsToAssign = [];
    for (const p of roleDef.permissions) {
      if (p.endsWith(':*')) {
        const resource = p.split(':')[0];
        const matching = allPerms.filter((ap) =>
          ap.action.startsWith(`${resource}:`),
        );
        permissionsToAssign.push(...matching);
      } else {
        const exact = allPerms.find((ap) => ap.action === p);
        if (exact) permissionsToAssign.push(exact);
      }
    }

    for (const perm of permissionsToAssign) {
      const existingRp = await rolePermissionRepo.findOne({
        where: { role_id: existingRole.id, permission_id: perm.id },
      });
      if (!existingRp) {
        await rolePermissionRepo.save(
          rolePermissionRepo.create({
            role_id: existingRole.id,
            permission_id: perm.id,
          }),
        );
      }
    }
  }

  console.log('✅ System roles and role-permissions seeded.');
}
