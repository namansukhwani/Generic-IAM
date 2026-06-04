import { UserEntity } from '../entities/user.entity';

export class UserResponseDto {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  manager_id: string | null;
  created_at: Date;
  updated_at: Date;

  constructor(partial: Partial<UserEntity>) {
    this.id = partial.id!;
    this.tenant_id = partial.tenant_id!;
    this.email = partial.email!;
    this.first_name = partial.first_name!;
    this.last_name = partial.last_name!;
    this.is_active = partial.is_active!;
    this.manager_id = partial.manager_id!;
    this.created_at = partial.created_at!;
    this.updated_at = partial.updated_at!;
  }
}
