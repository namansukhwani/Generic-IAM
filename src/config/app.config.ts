import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export default registerAs('app', () => {
  const values = {
    port: parseInt(process.env.APP_PORT || '3000', 10),
    env: process.env.APP_ENV || 'development',
    logLevel: process.env.APP_LOG_LEVEL || 'info',
  };

  const schema = Joi.object({
    port: Joi.number().default(3000),
    env: Joi.string()
      .valid('development', 'production', 'test')
      .default('development'),
    logLevel: Joi.string()
      .valid('error', 'warn', 'info', 'debug', 'verbose')
      .default('info'),
  });

  const { error, value } = schema.validate(values, { abortEarly: false });
  if (error) {
    throw new Error(`App configuration validation error: ${error.message}`);
  }

  return value;
});
