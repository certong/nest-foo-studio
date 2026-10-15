import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * Ten minutes, as in foo-auth (CP-43): a screen preflights once rather than
 * once per request, and a policy change still takes effect the same day.
 */
export const DEFAULT_CORS_MAX_AGE_SECONDS = 600;

/** scheme://host[:port], nothing else: no path, no trailing slash, no wildcard. */
const ORIGIN = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/;

/**
 * STUDIO_WEB_ORIGINS → the allowlist. Required: an empty allowlist would make
 * every browser call fail with a CORS error that says nothing about why, so
 * the app refuses to start instead.
 */
export function parseOrigins(value: string | undefined): string[] {
  const origins = (value ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (origins.length === 0) {
    throw new Error('STUDIO_WEB_ORIGINS is required: a comma-separated list of frontend origins');
  }
  const bad = origins.filter((o) => !ORIGIN.test(o));
  if (bad.length > 0) {
    throw new Error(`STUDIO_WEB_ORIGINS must be exact origins (scheme://host[:port]); got ${bad.join(', ')}`);
  }
  return origins;
}

/**
 * The whole CORS policy, as a value, so a suite can pin it: loosening it is a
 * security change.
 */
export function corsOptions(origins: string[], maxAge?: string | number): CorsOptions {
  return {
    origin: [...origins],
    // Bearer tokens only; Studio sets no cookies (the refresh cookie is foo-auth's).
    credentials: false,
    // PATCH is /portal/requests/:id/review.
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    // Idempotency-Key rides on the money and publish POSTs.
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    maxAge: positiveSeconds(maxAge) ?? DEFAULT_CORS_MAX_AGE_SECONDS,
  };
}

/** Null for anything but a positive number, so a typo falls back to the default. */
function positiveSeconds(value: string | number | undefined): number | null {
  if (value === undefined || value === '') return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}
