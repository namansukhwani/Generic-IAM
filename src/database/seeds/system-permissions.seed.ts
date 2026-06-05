import { DataSource } from 'typeorm';
import { PermissionEntity } from '../../modules/rbac/entities/permission.entity';
import { SYSTEM_PERMISSIONS } from '../../common/constants/system-permissions.constant';

function extractPermissions(obj: any): string[] {
  let perms: string[] = [];
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      perms.push(obj[key]);
    } else if (typeof obj[key] === 'object') {
      perms = perms.concat(extractPermissions(obj[key]));
    }
  }
  return perms;
}

export async function seedPermissions(dataSource: DataSource) {
  const permissionRepo = dataSource.getRepository(PermissionEntity);

  const permissionsToSeed = extractPermissions(SYSTEM_PERMISSIONS).map(
    (code) => {
      const parts = code.split('.');
      let service = parts[0];
      if (code === '*.*') {
        service = '*';
      }
      return {
        code,
        service,
        description: `Allow access for ${code}`,
      };
    },
  );

  for (const perm of permissionsToSeed) {
    const existing = await permissionRepo.findOne({
      where: { code: perm.code },
    });
    if (!existing) {
      await permissionRepo.save(permissionRepo.create(perm));
    }
  }

  console.log('✅ System permissions seeded.');
}
