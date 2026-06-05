const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module.js');
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  await app.close();
}
bootstrap();
