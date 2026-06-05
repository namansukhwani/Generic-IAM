import dataSource from '../data-source';
import { seedPermissions } from './system-permissions.seed';
import { seedRoles } from './system-roles.seed';
import { seedSuperAdmin } from './super-admin.seed';

async function bootstrap() {
  console.log('🚀 Starting database seeding...');

  await dataSource.initialize();

  try {
    await seedPermissions(dataSource);
    await seedRoles(dataSource);
    await seedSuperAdmin(dataSource);
    console.log('✅ Seeding completed successfully.');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    process.exit(0);
  }
}

void bootstrap();
