import { DataSource } from 'typeorm';
import { SuperAdminEntity } from '../../modules/super-admin/entities/super-admin.entity';
import * as bcrypt from 'bcrypt';

export async function seedSuperAdmin(dataSource: DataSource) {
  const superAdminRepo = dataSource.getRepository(SuperAdminEntity);

  const email = process.env.SUPER_ADMIN_EMAIL ?? 'superadmin@example.com';
  const password =
    process.env.SUPER_ADMIN_PASSWORD ?? 'SuperSecretPassword123!';

  const existing = await superAdminRepo.findOne({ where: { email } });

  if (!existing) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const superAdmin = superAdminRepo.create({
      email,
      password_hash: hashedPassword,
      is_active: true,
    });

    await superAdminRepo.save(superAdmin);
    console.log(`✅ SuperAdmin user seeded (${email}).`);
  } else {
    console.log(`ℹ️ SuperAdmin user (${email}) already exists.`);
  }
}
