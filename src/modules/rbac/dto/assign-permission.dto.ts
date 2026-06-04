import { IsUUID } from 'class-validator';

export class AssignPermissionDto {
  @IsUUID()
  permission_id: string;
}
