import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import KeyvRedis from '@keyv/redis';
import { CacheService } from './cache.service';

function buildRedisUrl(config: ConfigService): string {
  const pw = config.get<string>('redis.password');
  const host = config.get<string>('redis.host');
  const port = config.get<number>('redis.port');
  const db = config.get<number>('redis.db');
  return `redis://${pw ? `:${pw}@` : ''}${host}:${port}/${db}`;
}

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        stores: [new KeyvRedis(buildRedisUrl(configService))],
        ttl: configService.get<number>('redis.ttlMs', 300000),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    CacheService,
    {
      provide: 'CACHE_REDIS_URL',
      useFactory: (config: ConfigService) => buildRedisUrl(config),
      inject: [ConfigService],
    },
  ],
  exports: [CacheService, NestCacheModule, 'CACHE_REDIS_URL'],
})
export class CacheModule {}
