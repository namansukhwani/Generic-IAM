import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const details =
      exception instanceof HttpException ? exception.getResponse() : null;

    const correlationId =
      (request as any).correlationId || request.headers['x-correlation-id'];

    response.status(status).json({
      success: false,
      error: {
        code: status,
        message,
        details:
          typeof details === 'object' &&
          details !== null &&
          'message' in details
            ? (details as any).message
            : details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        correlation_id: correlationId,
      },
    });
  }
}
