import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRoleEntity } from './entities/user-role.entity';

@Injectable()
export class RbacScheduler {
  private readonly logger = new Logger(RbacScheduler.name);

  constructor(
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepository: Repository<UserRoleEntity>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpiredRoles(): Promise<void> {
    const result = await this.userRoleRepository
      .createQueryBuilder()
      .delete()
      .where('expires_at IS NOT NULL AND expires_at < :now', {
        now: new Date(),
      })
      .execute();
    this.logger.log(
      `Purged expired user_roles | count=${result.affected ?? 0}`,
    );
  }
}
