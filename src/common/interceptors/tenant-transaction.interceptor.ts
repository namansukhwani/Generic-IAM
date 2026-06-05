import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, from, of } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';
import { DataSource } from 'typeorm';
import { RequestContext } from '../interfaces/request-context.interface';
import { IdentityType } from '../constants/identity-types.constant';

@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  constructor(private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<RequestContext>();

    if (request.url.startsWith('/health')) {
      return next.handle();
    }

    const user = request.user;
    const tenantId = user?.tenant_id;
    const isSuperAdmin = user?.identity_type === IdentityType.SUPER_ADMIN;

    return of(this.dataSource.createQueryRunner()).pipe(
      switchMap((queryRunner) => {
        return from(queryRunner.connect()).pipe(
          switchMap(() => from(queryRunner.startTransaction())),
          switchMap(() => {
            const setConfigPromise =
              tenantId && !isSuperAdmin
                ? queryRunner.query(
                    `SELECT set_config('app.current_tenant_id', $1, true);`,
                    [tenantId],
                  )
                : Promise.resolve();

            return from(setConfigPromise).pipe(
              switchMap(() => {
                request.entityManager = queryRunner.manager;

                return next.handle().pipe(
                  // switchMap properly awaits the commit before the pipeline
                  // completes, preventing finalize() from releasing the
                  // QueryRunner while commitTransaction() is still pending.
                  switchMap(async (data) => {
                    if (queryRunner.isTransactionActive) {
                      await queryRunner.commitTransaction();
                    }
                    return data;
                  }),
                  catchError(async (err) => {
                    if (queryRunner.isTransactionActive) {
                      await queryRunner.rollbackTransaction();
                    }
                    throw err;
                  }),
                  finalize(() => {
                    if (!queryRunner.isReleased) {
                      queryRunner.release().catch((releaseErr) => {
                        console.error(
                          'Failed to release query runner',
                          releaseErr,
                        );
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
