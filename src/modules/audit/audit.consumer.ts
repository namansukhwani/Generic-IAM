import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AuditService } from './audit.service';

import { KAFKA_TOPICS } from '../../common/constants/kafka.constant';

@Controller()
export class AuditConsumer {
  constructor(private readonly auditService: AuditService) {}

  @EventPattern(KAFKA_TOPICS.IAM_AUDIT)
  handleAuditLog(@Payload() message: any) {
    this.auditService.pushEvent(message);
  }
}
