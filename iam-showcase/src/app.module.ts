import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IamModule } from '@iam/nestjs-sdk';
import { AppController } from './app.controller';
import { HealthController } from './health.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    IamModule.forRoot({
      iamUrl: process.env.IAM_URL ?? 'http://localhost:3000',
      redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
      jwtSecret: process.env.JWT_SECRET ?? 'your_jwt_secret',
    }),
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, Reflector],
})
export class AppModule {}
