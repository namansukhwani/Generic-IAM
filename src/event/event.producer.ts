import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';

export interface BaseEvent {
  event_type: string;
  tenant_id?: string;
  actor_id?: string;
  resource_type?: string;
  resource_id?: string;
  user_id?: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class EventProducer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventProducer.name);

  constructor(@Inject('KAFKA_CLIENT') private readonly client: ClientKafka) {}

  async onModuleInit() {
    try {
      await this.client.connect();
    } catch (err) {
      // A Kafka outage must not crash the application — events are best-effort.
      // KafkaJS will continue retrying in the background.
      this.logger.warn(
        `Kafka broker unavailable on startup — audit events will be buffered until reconnect. Reason: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.close();
    } catch {
      // Ignore close errors during shutdown
    }
  }

  emit(topic: string, event: BaseEvent): void {
    const key = `${event.tenant_id ?? 'system'}:${event.user_id ?? event.actor_id ?? 'unknown'}`;
    const message = {
      event_id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...event,
    };

    this.logger.log(
      `Emitting event | topic=${topic} event_type=${event.event_type} tenant_id=${event.tenant_id ?? 'system'} event_id=${message.event_id}`,
    );
    this.client.emit(topic, { key, value: message }).subscribe({
      error: (err: Error) =>
        this.logger.warn(
          `Failed to emit event ${event.event_type} to ${topic}: ${err.message}`,
        ),
    });
  }
}
