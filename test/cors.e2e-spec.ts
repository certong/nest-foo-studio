import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';

/** A UUIDv7, as Studio's ids are. */
const REQUEST_ID = '0199e5a8-7c00-7a43-9d1e-5b2f0c3a4e43';

/** vitest.config.mts sets STUDIO_WEB_ORIGINS to this. */
const ALLOWED = 'http://localhost:5182';

describe('CORS', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('a preflight for a money POST from the frontend is allowed, Idempotency-Key included', async () => {
    const res = await request(app.getHttpServer())
      .options(`/portal/requests/${REQUEST_ID}/approve`)
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type,idempotency-key')
      .expect(204);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers['access-control-allow-headers']).toBe('Content-Type,Authorization,Idempotency-Key');
    expect(res.headers['access-control-allow-methods']).toBe('GET,POST,PATCH,OPTIONS');
    expect(res.headers['access-control-max-age']).toBe('600');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('an actual request from the frontend carries the allow-origin header', async () => {
    const res = await request(app.getHttpServer()).get('/health').set('Origin', ALLOWED).expect(200);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
  });

  it('another origin gets no CORS headers', async () => {
    const res = await request(app.getHttpServer())
      .options(`/portal/requests/${REQUEST_ID}/approve`)
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
