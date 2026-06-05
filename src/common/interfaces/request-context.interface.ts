import { Request } from 'express';
import { JwtPayload } from './jwt-payload.interface';
import { EntityManager } from 'typeorm';

export interface RequestContext extends Request {
  user?: JwtPayload;
  tenant_id?: string;
  entityManager?: EntityManager;
}
