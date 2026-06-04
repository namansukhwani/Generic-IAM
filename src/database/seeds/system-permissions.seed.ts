import { DataSource } from 'typeorm';
import { PermissionEntity } from '../../modules/rbac/entities/permission.entity';

export async function seedPermissions(dataSource: DataSource) {
  const permissionRepo = dataSource.getRepository(PermissionEntity);
  
  const resources = [
    'expense', 'payroll', 'invoice', 'report', 'workflow', 
    'notification', 'user', 'role', 'acl', 'tenant', 'audit'
  ];
  const actions = ['read', 'write', 'delete', 'approve', 'export', 'execute', 'assign'];

  const permissionsToSeed = [];

  // Wildcard
  permissionsToSeed.push({
    action: '*:*',
    description: 'Full access to all resources and actions',
  });

  // Resource specific
  for (const resource of resources) {
    for (const action of actions) {
      permissionsToSeed.push({
        action: `${resource}:${action}`,
        description: `Allow ${action} on ${resource}`,
      });
    }
  }

  for (const perm of permissionsToSeed) {
    const existing = await permissionRepo.findOne({ where: { action: perm.action } });
    if (!existing) {
      await permissionRepo.save(permissionRepo.create(perm));
    }
  }

  console.log('✅ System permissions seeded.');
}
