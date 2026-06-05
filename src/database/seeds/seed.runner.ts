import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { seedPermissions } from './system-permissions.seed';
import { seedRoles } from './system-roles.seed';
import { seedSuperAdmin } from './super-admin.seed';

async function bootstrap() {
  console.log('🚀 Starting database seeding...');

  // We initialize the Nest application context to leverage dependency injection
  // and get the configured DataSource and ConfigService.
  const app = await NestFactory.createApplicationContext(AppModule);

  const dataSource = app.get(DataSource);
  const configService = app.get(ConfigService);

  try {
    await seedPermissions(dataSource);
    await seedRoles(dataSource);
    await seedSuperAdmin(dataSource, configService);
    console.log('✅ Seeding completed successfully.');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
