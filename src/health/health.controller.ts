import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MicroserviceHealthIndicator,
} from '@nestjs/terminus';
import { RedisOptions, Transport } from '@nestjs/microservices';
import { Public  } from '@iam/nestjs-sdk';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private microservice: MicroserviceHealthIndicator,
    private configService: ConfigService,
  ) {}

  @Public()
  @Get('live')
  checkLiveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  @HealthCheck()
  checkReadiness() {
    return this.health.check([
      // Check PostgreSQL
      () => this.db.pingCheck('database'),

      // Check Redis
      () =>
        this.microservice.pingCheck<RedisOptions>('redis', {
          transport: Transport.REDIS,
          options: {
            host: this.configService.get<string>('redis.host', 'localhost'),
            port: this.configService.get<number>('redis.port', 6379),
          },
        }),

      // Check Kafka
      () =>
        this.microservice.pingCheck('kafka', {
          transport: Transport.KAFKA,
          options: {
            client: {
              brokers: [
                this.configService.get<string>(
                  'kafka.broker',
                  'localhost:9092',
                ),
              ],
            },
          },
        }),
    ]);
  }

  @Public()
  @Get()
  checkDefault() {
    return { status: 'ok' };
  }
}
