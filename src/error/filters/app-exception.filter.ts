import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { StructuredException } from '../errors/structured.exception';

/**
 * Global exception filter for handling all exceptions
 * Returns consistent error response format
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: any;

    // Handle StructuredException
    if (exception instanceof StructuredException) {
      status = exception.httpStatus;
      errorResponse = exception.toResponse();
    }
    // Handle standard HttpException
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        errorResponse = {
          error: {
            code: 'HTTP_EXCEPTION',
            message: exceptionResponse,
            requestId: this.extractRequestId(request),
            timestamp: new Date().toISOString(),
            retryable: false,
          },
        };
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        errorResponse = {
          error: {
            code: responseObj.error?.code || 'HTTP_EXCEPTION',
            message: responseObj.message || responseObj.error?.message || 'HTTP Exception',
            details: responseObj.details || responseObj.error,
            requestId: this.extractRequestId(request),
            timestamp: new Date().toISOString(),
            retryable: false,
          },
        };
      }
    }
    // Handle generic errors
    else if (exception instanceof Error) {
      errorResponse = {
        error: {
          code: 'INTERNAL_SERVER_ERROR_500',
          message: process.env.NODE_ENV === 'production' ? 'An internal server error occurred' : exception.message,
          requestId: this.extractRequestId(request),
          timestamp: new Date().toISOString(),
          retryable: false,
          ...(process.env.NODE_ENV !== 'production' && { stack: exception.stack }),
        },
      };
    }
    // Handle unknown exceptions
    else {
      errorResponse = {
        error: {
          code: 'INTERNAL_SERVER_ERROR_500',
          message: 'An unknown error occurred',
          requestId: this.extractRequestId(request),
          timestamp: new Date().toISOString(),
          retryable: false,
        },
      };
    }

    // Log error in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('Exception caught by AppExceptionFilter:', exception);
    }

    response.status(status).json(errorResponse);
  }

  private extractRequestId(request: Request): string | undefined {
    return (request as any).requestId || (request.headers as any)['x-request-id'];
  }
}