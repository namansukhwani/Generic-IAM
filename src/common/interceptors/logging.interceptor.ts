import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RequestContext } from '../interfaces/request-context.interface';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<RequestContext>();
    const response = context.switchToHttp().getResponse();

    const { method, originalUrl } = request;
    const startTime = Date.now();

    this.logger.log(`url: ${originalUrl}, method: ${method}`);

    return next.handle().pipe(
      tap({
        next: (_data) => {
          this.log('INFO', context, request, response, startTime);
        },
        error: (error) => {
          this.log('ERROR', context, request, response, startTime, error);
        },
      }),
    );
  }

  private log(
    level: string,
    context: ExecutionContext,
    request: RequestContext,
    response: any,
    startTime: number,
    error?: any,
  ) {
    const duration_ms = Date.now() - startTime;
    const statusCode = error ? error.status || 500 : response.statusCode;

    const logData = {
      timestamp: new Date().toISOString(),
      level,
      method: request.method,
      url: request.originalUrl,
      status: statusCode,
      duration_ms,
      correlation_id: request.headers
        ? request.headers['x-correlation-id'] || 'N/A'
        : 'N/A',
      tenant_id: request.user?.tenant_id || 'N/A',
      user_id: request.user?.sub || 'N/A',
      action: context.getHandler().name,
      error: error ? error.message : undefined,
    };

    // Use JSON.stringify for structured JSON logging
    if (level === 'ERROR') {
      this.logger.error(JSON.stringify(logData));
    } else {
      this.logger.log(JSON.stringify(logData));
    }
  }
}
