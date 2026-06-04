import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Enable CORS
  app.enableCors({
    origin: '*', // Whitelist can be configured via env
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Apply Helmet
  app.use(helmet());

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('IAM Service API')
    .setDescription('Identity and Access Management API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Graceful shutdown
  app.enableShutdownHooks();

  // Kafka Microservice setup
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: configService.get<string[]>('kafka.brokers', ['localhost:9092']),
        clientId: configService.get<string>('kafka.clientId', 'iam-service-client'),
      },
      consumer: {
        groupId: configService.get<string>('kafka.groupId', 'iam-service-group'),
      },
    },
  });
  
  await app.startAllMicroservices();

  const port = configService.get<number>('app.port', 3000);
  await app.listen(port);
  logger.log(`IAM Service is running on: http://localhost:${port}/api/v1`);
}
bootstrap();
