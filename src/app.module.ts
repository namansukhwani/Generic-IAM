import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import kafkaConfig from './config/kafka.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig, kafkaConfig],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
