import { z } from 'zod';

/**
 * Building blocks every portal schema shares. Nothing in src/contract imports
 * Nest: these files are the contract itself, and openapi.json is generated from
 * them.
 */

/** UTC ISO timestamp, e.g. 2026-10-15T06:09:00.000Z. */
export const IsoDateTime = z.iso.datetime();

/** Calendar date, e.g. 2026-11-01 (reset dates, reply-by days). */
export const IsoDate = z.iso.date();

/** Calendar month, e.g. 2026-10 (ledger and usage charts). */
export const IsoMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM');

/** Database ids are integers (request #43). Path params arrive as strings. */
export const Id = z.number().int().positive();
export const IdParam = z.object({ id: z.coerce.number().int().positive() });

/** A credit amount. Signed only where a ledger row says so. */
export const Credits = z.number().int().nonnegative();

/** Cursor paging: ?cursor=…&limit=20, reply carries nextCursor (null on the last page). */
export const PageQuery = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export function page<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}
