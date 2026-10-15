import { corsOptions, DEFAULT_CORS_MAX_AGE_SECONDS, parseOrigins } from './cors';

describe('corsOptions', () => {
  const origins = ['http://localhost:5182', 'https://studio.foocertong.com'];

  it('pins the whole policy', () => {
    expect(corsOptions(origins)).toEqual({
      origin: origins,
      // Bearer only: Studio sets no cookies.
      credentials: false,
      methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
      maxAge: DEFAULT_CORS_MAX_AGE_SECONDS,
    });
  });

  it('copies the allowlist rather than sharing it', () => {
    const options = corsOptions(origins);
    expect(options.origin).not.toBe(origins);
  });

  it('takes maxAge from the environment when it is a positive number', () => {
    expect(corsOptions(origins, '120').maxAge).toBe(120);
  });

  it.each(['', '0', '-5', 'ten', undefined])('falls back to the default for maxAge %j', (value) => {
    expect(corsOptions(origins, value).maxAge).toBe(DEFAULT_CORS_MAX_AGE_SECONDS);
  });
});

describe('parseOrigins', () => {
  it('splits a comma-separated list and trims it', () => {
    expect(parseOrigins(' http://localhost:5182 , https://studio.foocertong.com ')).toEqual([
      'http://localhost:5182',
      'https://studio.foocertong.com',
    ]);
  });

  it.each([undefined, '', ' , '])('refuses a missing or empty allowlist (%j)', (value) => {
    expect(() => parseOrigins(value)).toThrow(/STUDIO_WEB_ORIGINS/);
  });

  it.each(['*', 'localhost:5182', 'http://localhost:5182/', 'https://*.pages.dev'])(
    'refuses %j: origins are exact scheme://host[:port]',
    (value) => {
      expect(() => parseOrigins(value)).toThrow(/STUDIO_WEB_ORIGINS/);
    },
  );
});
