import {
  Injectable,
  Inject,
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
  payload?: any;
}

@Injectable()
export class EventProducer implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject('KAFKA_CLIENT') private readonly client: ClientKafka) {}

  async onModuleInit() {
    // Only if we need to subscribe to replies, which we don't for fire-and-forget
    // but we need to connect the producer. Nest does this lazily on first emit,
    // but good practice to connect here.
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  emit(topic: string, event: BaseEvent): void {
    const key = `${event.tenant_id || 'system'}:${event.user_id || event.actor_id || 'unknown'}`;
    const message = {
      event_id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...event,
    };

    // Fire and forget using emit
    this.client.emit(topic, { key, value: message });
  }
}
