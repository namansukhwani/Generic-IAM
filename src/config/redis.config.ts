import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export default registerAs('redis', () => {
  const values = {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
  };

  const schema = Joi.object({
    host: Joi.string().required(),
    port: Joi.number().default(6379),
    password: Joi.string().allow(''),
    db: Joi.number().default(0),
  });

  const { error, value } = schema.validate(values, { abortEarly: false });
  if (error) {
    throw new Error(`Redis configuration validation error: ${error.message}`);
  }

  return value;
});
