import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger } from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

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

    const logMessage = `[${request.method}] ${request.url} - Status: ${status} - Error: ${message} - CorrelationId: ${correlationId}`;
    if ((status as HttpStatus) >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        logMessage,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(logMessage);
    }

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
