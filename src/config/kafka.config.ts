import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export default registerAs('kafka', () => {
  const values = {
    brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : [],
    clientId: process.env.KAFKA_CLIENT_ID,
    groupId: process.env.KAFKA_GROUP_ID,
  };

  const schema = Joi.object({
    brokers: Joi.array().items(Joi.string()).min(1).required(),
    clientId: Joi.string().required(),
    groupId: Joi.string().required(),
  });

  const { error, value } = schema.validate(values, { abortEarly: false });
  if (error) {
    throw new Error(`Kafka configuration validation error: ${error.message}`);
  }

  return value;
});
