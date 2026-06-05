import { Module, Global } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventProducer } from './event.producer';
import { EventConsumer } from './event.consumer';
import { CacheModule } from '../cache/cache.module';

@Global()
@Module({
  imports: [
    CacheModule,
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_CLIENT',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId:
                configService.get<string>('kafka.clientId') || 'iam-client',
              brokers: configService.get<string[]>('kafka.brokers') || [
                'localhost:9092',
              ],
            },
            producerOnlyMode: true, // We only use this client for producing
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [EventConsumer],
  providers: [EventProducer],
  exports: [EventProducer],
})
export class EventModule {}
