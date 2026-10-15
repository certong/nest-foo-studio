import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TEST_CLIENT_HEADER } from './create-test-app';

/** A UUIDv7, as Studio's ids are. */
const REQUEST_ID = '0199e5a8-7c00-7a43-9d1e-5b2f0c3a4e43';

describe('portal contract over HTTP', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('GET /health is up without a token', async () => {
    await http().get('/health').expect(200, { status: 'ok' });
  });

  it('a portal route without a signed-in client is TOKEN_EXPIRED', async () => {
    const res = await http().get('/portal/me').expect(401);
    expect(res.body).toMatchObject({ code: 'TOKEN_EXPIRED', message: expect.any(String) });
  });

  it('a stub route answers NOT_IMPLEMENTED and names its ticket', async () => {
    const res = await http().get('/portal/me').set(TEST_CLIENT_HEADER, '7').expect(501);
    expect(res.body).toEqual({ code: 'NOT_IMPLEMENTED', message: 'Built in FS-86', details: { ticket: 'FS-86' } });
  });

  it('a body that fails zod is VALIDATION_FAILED with the failing fields', async () => {
    const res = await http()
      .post('/portal/requests')
      .set(TEST_CLIENT_HEADER, '7')
      .send({ type: 'website' })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.details.fields).toEqual([{ path: 'type', message: expect.any(String) }]);
  });

  it('a path id that is not a UUID is VALIDATION_FAILED, so requests/summary is not read as an id', async () => {
    await http().get('/portal/requests/43').set(TEST_CLIENT_HEADER, '7').expect(400);
    await http().get(`/portal/requests/${REQUEST_ID}`).set(TEST_CLIENT_HEADER, '7').expect(501);
    const res = await http().get('/portal/requests/summary').set(TEST_CLIENT_HEADER, '7').expect(501);
    expect(res.body.details).toEqual({ ticket: 'FS-90' });
  });

  it('a money POST without Idempotency-Key is VALIDATION_FAILED', async () => {
    const res = await http()
      .post(`/portal/requests/${REQUEST_ID}/approve`)
      .set(TEST_CLIENT_HEADER, '7')
      .send({ checkedText: true })
      .expect(400);
    expect(res.body.details.fields).toEqual([{ path: 'headers.Idempotency-Key', message: expect.any(String) }]);
  });

  it('a money POST with Idempotency-Key reaches the handler', async () => {
    await http()
      .post(`/portal/requests/${REQUEST_ID}/approve`)
      .set(TEST_CLIENT_HEADER, '7')
      .set('Idempotency-Key', '6f1c2a4e-9b0d-4c4e-8a51-0f6a1d2b3c4d')
      .send({ checkedText: true })
      .expect(501);
  });

  it('an unknown route is NOT_FOUND in the envelope', async () => {
    const res = await http().get('/portal/nope').expect(404);
    expect(res.body).toEqual({ code: 'NOT_FOUND', message: expect.any(String) });
  });

  it('malformed JSON is VALIDATION_FAILED', async () => {
    const res = await http()
      .post('/portal/requests')
      .set(TEST_CLIENT_HEADER, '7')
      .set('Content-Type', 'application/json')
      .send('{"type":')
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });
});
