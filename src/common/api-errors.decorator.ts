import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ERRORS, type ErrorCode } from '../contract/errors';

/** components.schemas name for one code's envelope; openapi.ts registers them. */
export function errorSchemaName(code: ErrorCode): string {
  return `Error_${code}`;
}

/** Errors every portal route can return, on top of the ones a route lists. */
const ALWAYS: ErrorCode[] = ['VALIDATION_FAILED', 'TOKEN_EXPIRED', 'RATE_LIMITED', 'INTERNAL'];

/**
 * Documents the error replies a route can send. Codes sharing an HTTP status
 * (402, 409, 422) become a oneOf, so FE can mock each error screen.
 */
export function ApiErrors(...codes: ErrorCode[]): MethodDecorator {
  const byStatus = new Map<number, ErrorCode[]>();
  for (const code of [...new Set([...ALWAYS, ...codes])]) {
    const http = ERRORS[code].http;
    byStatus.set(http, [...(byStatus.get(http) ?? []), code]);
  }
  return applyDecorators(
    ...[...byStatus].map(([status, group]) =>
      ApiResponse({
        status,
        description: group.map((c) => `${c}: ${ERRORS[c].when}`).join('\n\n'),
        schema:
          group.length === 1
            ? { $ref: `#/components/schemas/${errorSchemaName(group[0]!)}` }
            : { oneOf: group.map((c) => ({ $ref: `#/components/schemas/${errorSchemaName(c)}` })) },
      }),
    ),
  );
}
