import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    let correlationId = request.headers['x-correlation-id'];

    if (!correlationId) {
      correlationId = uuidv4();
      request.headers['x-correlation-id'] = correlationId;
    }

    request.correlationId = correlationId;

    const response = context.switchToHttp().getResponse();
    response.setHeader('X-Correlation-ID', correlationId);

    return next.handle();
  }
}
