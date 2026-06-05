import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, from, of } from 'rxjs';
import { tap, catchError, finalize, switchMap } from 'rxjs/operators';
import { DataSource } from 'typeorm';
import { RequestContext } from '../interfaces/request-context.interface';
import { IdentityType } from '../constants/identity-types.constant';

@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  constructor(private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<RequestContext>();

    // Bypass for health checks
    if (request.url.startsWith('/health')) {
      return next.handle();
    }

    const user = request.user;
    const tenantId = user?.tenant_id;
    const isSuperAdmin = user?.identity_type === IdentityType.SUPER_ADMIN;

    // Fast path: public routes or missing tenant for non-super-admin where transaction isn't strictly RLS isolated
    // However, if we always want a transaction, we can proceed. We will proceed to wrap everything.

    return of(this.dataSource.createQueryRunner()).pipe(
      switchMap((queryRunner) => {
        return from(queryRunner.connect()).pipe(
          switchMap(() => from(queryRunner.startTransaction())),
          switchMap(() => {
            // Set RLS config if tenant is present and not super admin
            const setConfigPromise =
              tenantId && !isSuperAdmin
                ? queryRunner.query(
                    `SELECT set_config('app.current_tenant_id', $1, true);`,
                    [tenantId],
                  )
                : Promise.resolve();

            return from(setConfigPromise).pipe(
              switchMap(() => {
                // Attach manager to request for downstream use
                request.entityManager = queryRunner.manager;

                return next.handle().pipe(
                  tap(() => {
                    if (queryRunner.isTransactionActive) {
                      queryRunner.commitTransaction().catch((err) => {
                        console.error('Failed to commit transaction', err);
                      });
                    }
                  }),
                  catchError(async (err) => {
                    if (queryRunner.isTransactionActive) {
                      await queryRunner.rollbackTransaction();
                    }
                    throw err;
                  }),
                  finalize(() => {
                    if (!queryRunner.isReleased) {
                      queryRunner.release().catch((err) => {
                        console.error('Failed to release query runner', err);
                      });
                    }
                  }),
                );
              }),
            );
          }),
        );
      }),
    );
  }
}
