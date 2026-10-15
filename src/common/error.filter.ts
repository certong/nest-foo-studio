import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import type { ZodError } from 'zod';
import { ERRORS, type ErrorBody, type ErrorCode } from '../contract/errors';
import { StudioException } from './studio-exception';

/** Nest's own exceptions (bad JSON, unknown route, …) mapped onto our codes. */
const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'TOKEN_EXPIRED',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

export function zodFields(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

/**
 * Every error leaves as { code, message, details? }. Unexpected errors are
 * logged once, here, and reach the client as a bare INTERNAL.
 */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const [status, body] = this.toReply(exception);
    res.status(status).json(body);
  }

  private toReply(exception: unknown): [number, ErrorBody] {
    if (exception instanceof StudioException) {
      return [exception.getStatus(), exception.toBody()];
    }
    if (exception instanceof ZodValidationException) {
      const error = exception.getZodError() as ZodError;
      return [400, { code: 'VALIDATION_FAILED', message: ERRORS.VALIDATION_FAILED.when, details: { fields: zodFields(error) } }];
    }
    if (exception instanceof HttpException) {
      const code = CODE_BY_STATUS[exception.getStatus()];
      if (code === 'VALIDATION_FAILED') {
        return [400, { code, message: exception.message, details: { fields: [] } }];
      }
      if (code && ERRORS[code].details === null) {
        return [ERRORS[code].http, { code, message: exception.message }];
      }
    }
    this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    return [500, { code: 'INTERNAL', message: ERRORS.INTERNAL.when }];
  }
}
