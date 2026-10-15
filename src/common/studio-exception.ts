import { HttpException } from '@nestjs/common';
import { ERRORS, type ErrorBody, type ErrorCode, type ErrorDetails } from '../contract/errors';

type DetailsArgs<C extends ErrorCode> =
  ErrorDetails<C> extends undefined
    ? [details?: undefined, message?: string]
    : [details: ErrorDetails<C>, message?: string];

/**
 * The one exception services throw. The code fixes the HTTP status, and the
 * compiler checks details against the contract:
 *
 *   throw new StudioException('NOT_FOUND');
 *   throw new StudioException('RATE_LIMITED', { retryAfter: 30 });
 */
export class StudioException<C extends ErrorCode = ErrorCode> extends HttpException {
  readonly code: C;
  readonly details: ErrorDetails<C>;

  constructor(code: C, ...[details, message]: DetailsArgs<C>) {
    const text = message ?? ERRORS[code].when;
    super(text, ERRORS[code].http);
    this.code = code;
    this.details = details as ErrorDetails<C>;
  }

  toBody(): ErrorBody {
    const body: ErrorBody = { code: this.code, message: this.message };
    if (this.details !== undefined) body.details = this.details as Record<string, unknown>;
    return body;
  }
}

/** Every stub handler throws this until its ticket builds it. */
export function notImplemented(ticket: string): never {
  throw new StudioException('NOT_IMPLEMENTED', { ticket }, `Built in ${ticket}`);
}
