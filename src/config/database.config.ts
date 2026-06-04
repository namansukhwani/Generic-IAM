import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export default registerAs('database', () => {
  const values = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true',
  };

  const schema = Joi.object({
    host: Joi.string().required(),
    port: Joi.number().default(5432),
    name: Joi.string().required(),
    username: Joi.string().required(),
    password: Joi.string().required(),
    ssl: Joi.boolean().default(false),
  });

  const { error, value } = schema.validate(values, { abortEarly: false });
  if (error) {
    throw new Error(`Database configuration validation error: ${error.message}`);
  }

  return value;
});
