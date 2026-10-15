import { applyDecorators, CanActivate, ExecutionContext, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import type { Request } from 'express';
import { StudioException } from './studio-exception';

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
export const REQUIRES_IDEMPOTENCY_KEY = 'requiresIdempotencyKey';

const VALID_KEY = /^[A-Za-z0-9_-]{8,128}$/;

@Injectable()
export class IdempotencyKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const key = context.switchToHttp().getRequest<Request>().header(IDEMPOTENCY_HEADER);
    if (!key || !VALID_KEY.test(key)) {
      throw new StudioException('VALIDATION_FAILED', {
        fields: [{ path: `headers.${IDEMPOTENCY_HEADER}`, message: 'Required: 8–128 of A–Z a–z 0–9 _ -' }],
      });
    }
    return true;
  }
}

/**
 * For any POST that spends credits, publishes or grants. Same key twice
 * returns the first result; storing and replaying that result arrives with
 * the credits service (FS-92). Until then this only requires the header.
 */
export function RequireIdempotencyKey(): MethodDecorator {
  return applyDecorators(
    SetMetadata(REQUIRES_IDEMPOTENCY_KEY, true),
    ApiHeader({
      name: IDEMPOTENCY_HEADER,
      required: true,
      description: 'A fresh UUID per user action. Retrying with the same key returns the first result.',
      schema: { type: 'string', pattern: VALID_KEY.source },
    }),
    UseGuards(IdempotencyKeyGuard),
  );
}
