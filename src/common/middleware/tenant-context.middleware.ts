import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private dataSource: DataSource) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Basic extraction from JWT (to be refined in Phase 3/5 with AuthGuard)
    let tenantId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const payloadStr = Buffer.from(token.split('.')[1], 'base64').toString();
        const payload = JSON.parse(payloadStr);
        tenantId = payload.tenant_id;
      } catch (e) {
        // Ignore parsing errors here
      }
    }

    if (tenantId) {
      // SET LOCAL works only inside a transaction, so we use a transaction context
      // for the entire request if we want it to persist, or set it via query runner.
      // NestJS TypeORM integration handles transactions differently.
      // For now, we will simply inject the tenantId into the request object,
      // and let the repositories/services apply it, OR use TypeORM's queryRunner.
      // A more robust approach for TypeORM RLS is to use a custom repository or Interceptor
      // that sets the context on the query runner.
      // Implementing SET LOCAL app.current_tenant requires a transaction.
      (req as any).tenant_id = tenantId;
    }

    next();
  }
}
