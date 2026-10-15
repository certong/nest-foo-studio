import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import { z } from 'zod';
import { ERROR_CODES, ERRORS, errorEnvelope } from '../contract/errors';
import { ErrorFilter } from './error.filter';
import { StudioException } from './studio-exception';

function reply(exception: unknown): { status: number; body: unknown } {
  const out = { status: 0, body: undefined as unknown };
  const res = {
    status(code: number) {
      out.status = code;
      return this;
    },
    json(body: unknown) {
      out.body = body;
    },
  };
  const host = { switchToHttp: () => ({ getResponse: () => res }) } as unknown as ArgumentsHost;
  new ErrorFilter().catch(exception, host);
  return out;
}

describe('error codes', () => {
  it('match the HTTP statuses in FS-85', () => {
    const http = Object.fromEntries(ERROR_CODES.map((c) => [c, ERRORS[c].http]));
    expect(http).toEqual({
      VALIDATION_FAILED: 400,
      TOKEN_EXPIRED: 401,
      NOT_ENOUGH_CREDITS: 402,
      AI_CAP_REACHED: 402,
      WORKSPACE_READ_ONLY: 403,
      NOT_FOUND: 404,
      STALE_PATCH: 409,
      INVALID_STATE: 409,
      LIMIT_REACHED: 422,
      SKETCH_UNREADABLE: 422,
      RATE_LIMITED: 429,
      NOT_IMPLEMENTED: 501,
      AGENT_OFFLINE: 503,
      INTERNAL: 500,
    });
  });
});

describe('ErrorFilter', () => {
  it('sends a StudioException as its code, status and details', () => {
    const details = { needed: 20, have: 10, short: 10, resetOn: '2026-11-01', draftId: '0199e5a8-7c00-7a43-9d1e-5b2f0c3a4e43' };
    const { status, body } = reply(new StudioException('NOT_ENOUGH_CREDITS', details));
    expect(status).toBe(402);
    expect(body).toEqual({ code: 'NOT_ENOUGH_CREDITS', message: ERRORS.NOT_ENOUGH_CREDITS.when, details });
    expect(() => errorEnvelope('NOT_ENOUGH_CREDITS').parse(body)).not.toThrow();
  });

  it('leaves details out for a code that has none', () => {
    expect(reply(new StudioException('INVALID_STATE', undefined, 'Already approved'))).toEqual({
      status: 409,
      body: { code: 'INVALID_STATE', message: 'Already approved' },
    });
  });

  it('turns a zod failure into VALIDATION_FAILED with the failing fields', () => {
    const result = z.object({ note: z.string().min(1) }).safeParse({ note: '' });
    if (result.success) throw new Error('expected a zod failure');
    const { status, body } = reply(new ZodValidationException(result.error));
    expect(status).toBe(400);
    expect(body).toMatchObject({ code: 'VALIDATION_FAILED', details: { fields: [{ path: 'note' }] } });
  });

  it('maps Nest’s own 404 and 400 onto the envelope', () => {
    expect(reply(new NotFoundException('Cannot GET /x'))).toEqual({
      status: 404,
      body: { code: 'NOT_FOUND', message: 'Cannot GET /x' },
    });
    expect(reply(new BadRequestException('Unexpected end of JSON input'))).toMatchObject({
      status: 400,
      body: { code: 'VALIDATION_FAILED', details: { fields: [] } },
    });
  });

  it('hides an unexpected error behind INTERNAL, and logs it once', () => {
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { status, body } = reply(new Error('connection string postgres://secret'));
    expect(status).toBe(500);
    expect(body).toEqual({ code: 'INTERNAL', message: ERRORS.INTERNAL.when });
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
});
