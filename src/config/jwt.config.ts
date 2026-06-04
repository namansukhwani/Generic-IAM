import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export default registerAs('jwt', () => {
  const values = {
    secret: process.env.JWT_SECRET,
    accessTtl: parseInt(process.env.JWT_ACCESS_TTL || '900', 10),
    refreshTtl: parseInt(process.env.JWT_REFRESH_TTL || '604800', 10),
    serviceTtl: parseInt(process.env.JWT_SERVICE_TTL || '3600', 10),
  };

  const schema = Joi.object({
    secret: Joi.string().required(),
    accessTtl: Joi.number().required(),
    refreshTtl: Joi.number().required(),
    serviceTtl: Joi.number().required(),
  });

  const { error, value } = schema.validate(values, { abortEarly: false });
  if (error) {
    throw new Error(`JWT configuration validation error: ${error.message}`);
  }

  return value;
});
