import { DataSource } from 'typeorm';
import { UserEntity } from '../../modules/user/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

export async function seedSuperAdmin(
  dataSource: DataSource,
  configService: ConfigService,
) {
  const userRepo = dataSource.getRepository(UserEntity);

  const email = configService.get<string>(
    'SUPER_ADMIN_EMAIL',
    'superadmin@example.com',
  );
  const password = configService.get<string>(
    'SUPER_ADMIN_PASSWORD',
    'SuperSecretPassword123!',
  );

  const existing = await userRepo.findOne({ where: { email } });

  if (!existing) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const superAdmin = userRepo.create({
      email,
      password_hash: hashedPassword,
      first_name: 'Super',
      last_name: 'Admin',
      is_active: true,
      tenant_id: null as any, // Global user
    });

    await userRepo.save(superAdmin);
    console.log(`✅ SuperAdmin user seeded (${email}).`);
  } else {
    console.log(`ℹ️ SuperAdmin user (${email}) already exists.`);
  }
}
