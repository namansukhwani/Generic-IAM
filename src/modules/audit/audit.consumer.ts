import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AuditService, AuditEventPayload } from './audit.service';

import { KAFKA_TOPICS } from '../../common/constants/kafka.constant';

@Controller()
export class AuditConsumer {
  constructor(private readonly auditService: AuditService) {}

  @EventPattern(KAFKA_TOPICS.IAM_AUDIT)
  handleAuditLog(@Payload() message: AuditEventPayload) {
    this.auditService.pushEvent(message);
  }
}
