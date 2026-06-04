import { Request } from 'express';
import { JwtPayload } from './jwt-payload.interface';

export interface RequestContext extends Request {
  user?: JwtPayload;
  tenant_id?: string;
}
