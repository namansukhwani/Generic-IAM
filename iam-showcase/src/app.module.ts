import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IamModule } from '@iam/nestjs-sdk';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    IamModule.forRoot({
      iamUrl: 'http://localhost:3000',
      redisUrl: 'redis://localhost:6379',
      jwtSecret: 'your_jwt_secret',
    }),
  ],
  controllers: [AppController],
  providers: [AppService, Reflector],
})
export class AppModule {}
