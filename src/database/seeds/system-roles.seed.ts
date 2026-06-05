import { DataSource, IsNull } from 'typeorm';
import { RoleEntity } from '../../modules/rbac/entities/role.entity';
import { PermissionEntity } from '../../modules/rbac/entities/permission.entity';
import { RolePermissionEntity } from '../../modules/rbac/entities/role-permission.entity';
import { SYSTEM_PERMISSIONS } from '../../common/constants/system-permissions.constant';

export async function seedRoles(dataSource: DataSource) {
  const roleRepo = dataSource.getRepository(RoleEntity);
  const permissionRepo = dataSource.getRepository(PermissionEntity);
  const rolePermissionRepo = dataSource.getRepository(RolePermissionEntity);

  const rolesData = [
    {
      name: 'Super Admin',
      description: 'System-wide super administrator',
      permissions: [SYSTEM_PERMISSIONS.GLOBAL_ALL],
    },
    {
      name: 'Tenant Admin',
      description: 'Full access to tenant resources',
      permissions: [
        SYSTEM_PERMISSIONS.USER.ALL,
        SYSTEM_PERMISSIONS.ROLE.ALL,
        SYSTEM_PERMISSIONS.ACL.ALL,
        SYSTEM_PERMISSIONS.EXPENSE.ALL,
        SYSTEM_PERMISSIONS.PAYROLL.ALL,
        SYSTEM_PERMISSIONS.INVOICE.ALL,
        SYSTEM_PERMISSIONS.REPORT.ALL,
        SYSTEM_PERMISSIONS.WORKFLOW.ALL,
      ],
    },
    {
      name: 'Auditor',
      description: 'Read-only access to audit logs and reports',
      permissions: [
        SYSTEM_PERMISSIONS.AUDIT.READ,
        SYSTEM_PERMISSIONS.REPORT.READ,
        SYSTEM_PERMISSIONS.EXPENSE.ALL, // They get expense.* for read. We will refine it.
        SYSTEM_PERMISSIONS.PAYROLL.READ,
        SYSTEM_PERMISSIONS.INVOICE.READ,
      ],
    },
    {
      name: 'Employee',
      description: 'Basic employee access',
      permissions: [
        SYSTEM_PERMISSIONS.EXPENSE.EXPENSES.READ,
        SYSTEM_PERMISSIONS.EXPENSE.EXPENSES.CREATE,
        SYSTEM_PERMISSIONS.PAYROLL.READ,
      ],
    },
    {
      name: 'Manager',
      description: 'Managerial access for approvals',
      permissions: [
        SYSTEM_PERMISSIONS.EXPENSE.EXPENSES.READ,
        SYSTEM_PERMISSIONS.EXPENSE.APPROVALS.CLAIMS.APPROVE,
        SYSTEM_PERMISSIONS.PAYROLL.READ,
        SYSTEM_PERMISSIONS.REPORT.READ,
      ],
    },
    {
      name: 'Billing Manager',
      description: 'Access to invoices and billing',
      permissions: [
        SYSTEM_PERMISSIONS.INVOICE.READ,
        SYSTEM_PERMISSIONS.INVOICE.WRITE,
        SYSTEM_PERMISSIONS.INVOICE.APPROVE,
        SYSTEM_PERMISSIONS.REPORT.READ,
        SYSTEM_PERMISSIONS.REPORT.EXPORT,
      ],
    },
  ];

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

    const permissionsToAssign = [];
    for (const p of roleDef.permissions) {
      if (p.endsWith('.*')) {
        const prefix = p.replace('.*', '');
        const matching = allPerms.filter((ap) => ap.code.startsWith(prefix));
        permissionsToAssign.push(...matching);
      } else {
        const exact = allPerms.find((ap) => ap.code === p);
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
