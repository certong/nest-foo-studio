import { z } from 'zod';
import { Credits, Id, IsoDate } from './common';

/**
 * Every non-2xx reply is { code, message, details? }. One entry per code: its
 * HTTP status and the shape of its details. A service throws
 * new StudioException('NOT_ENOUGH_CREDITS', { … }) and the compiler checks the
 * details against this table.
 *
 * PIN errors (PIN_INVALID) come from the auth service, not Studio.
 */
export const ERRORS = {
  VALIDATION_FAILED: {
    http: 400,
    when: 'Body, query or path fails the zod schema, or a required header is missing',
    details: z.object({
      fields: z.array(z.object({ path: z.string(), message: z.string() })),
    }),
  },
  TOKEN_EXPIRED: {
    http: 401,
    when: 'Access token missing, invalid or past its 15 min; refresh silently, then retry',
    details: null,
  },
  NOT_ENOUGH_CREDITS: {
    http: 402,
    when: 'Free credits below the action price',
    details: z.object({
      needed: Credits,
      have: Credits,
      short: Credits,
      resetOn: IsoDate,
      draftId: Id.nullable(),
    }),
  },
  AI_CAP_REACHED: {
    http: 402,
    when: 'Hidden RM cap hit; show the same screen as NOT_ENOUGH_CREDITS without RM',
    details: z.object({ resetOn: IsoDate }),
  },
  WORKSPACE_READ_ONLY: {
    http: 403,
    when: 'Workspace overdue or deactivated',
    details: null,
  },
  NOT_FOUND: {
    http: 404,
    when: "Wrong id, or another client's id",
    details: null,
  },
  STALE_PATCH: {
    http: 409,
    when: 'baseCommit or old text no longer matches; agent-ba rebuilds the patch',
    details: null,
  },
  INVALID_STATE: {
    http: 409,
    when: 'Action not allowed in this status (e.g. approve twice); refresh the request',
    details: null,
  },
  LIMIT_REACHED: {
    http: 422,
    when: '10 changes, 5 sections, 5 images or the chat turns are used up',
    details: z.object({
      limit: z.enum(['changes', 'sections', 'images', 'chat_turns']),
      max: z.number().int().positive(),
    }),
  },
  SKETCH_UNREADABLE: {
    http: 422,
    when: "The sketch can't be mapped to blocks; offer the layouts instead",
    details: null,
  },
  RATE_LIMITED: {
    http: 429,
    when: 'Too many calls',
    details: z.object({ retryAfter: z.number().int().positive().describe('Seconds') }),
  },
  NOT_IMPLEMENTED: {
    http: 501,
    when: 'Route is in the contract but not built yet; details.ticket says which ticket builds it',
    details: z.object({ ticket: z.string() }),
  },
  AGENT_OFFLINE: {
    http: 503,
    when: "AI call failed or timed out. The client's message is saved, nothing is charged, the hold is released",
    details: z.object({
      messageSeq: z.number().int().positive(),
      retryAfter: z.number().int().positive().describe('Seconds'),
    }),
  },
  INTERNAL: {
    http: 500,
    when: 'Unexpected server error',
    details: null,
  },
} as const satisfies Record<string, { http: number; when: string; details: z.ZodObject | null }>;

export type ErrorCode = keyof typeof ERRORS;
export const ERROR_CODES = Object.keys(ERRORS) as ErrorCode[];

export type ErrorDetails<C extends ErrorCode> = (typeof ERRORS)[C]['details'] extends z.ZodType
  ? z.infer<(typeof ERRORS)[C]['details'] & z.ZodType>
  : undefined;

/** The reply body for one code. */
export function errorEnvelope<C extends ErrorCode>(code: C) {
  const details = ERRORS[code].details;
  return z.object({
    code: z.literal(code),
    message: z.string(),
    ...(details ? { details } : {}),
  });
}

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
