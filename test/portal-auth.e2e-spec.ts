import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, signToken, type TokenOptions } from './auth-tokens';
import { createTestApp } from './create-test-app';

/**
 * PortalAuthGuard on a /portal route. A stub route (501) tells "the guard let
 * it through" apart from a refusal (401) without needing a database.
 */
describe('portal token check (FS-86)', () => {
  let app: INestApplication;
  const ROUTE = '/portal/home';

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const call = (authorization?: string) => {
    const req = request(app.getHttpServer()).get(ROUTE);
    return authorization ? req.set('Authorization', authorization) : req;
  };

  it("lets a Kopi Lane client's access token through", async () => {
    await call(await bearer()).expect(501);
  });

  const refused: Array<[string, () => Promise<string | undefined>]> = [
    ['no Authorization header', async () => undefined],
    ['not a Bearer header', async () => `Basic ${await signToken()}`],
    ['an empty Bearer token', async () => 'Bearer '],
    ['a malformed token', async () => 'Bearer not.a.jwt'],
    ['an expired token', () => bearer({ expiresIn: '-1s' })],
    ['a token signed by another key', () => bearer({ foreignKey: true })],
    ["billing's token (wrong audience)", () => bearer({ audience: 'billing' })],
    ['another issuer', () => bearer({ issuer: 'http://evil.test' })],
    ['a refresh token', () => bearer({ claims: { typ: 'refresh' } })],
    ['a staff account', () => bearer({ claims: { account_type: 'staff', client_id: undefined } })],
    ['a client token without client_id', () => bearer({ claims: { client_id: undefined } })],
    ['a client_id that is not a positive integer', () => bearer({ claims: { client_id: '9001' } })],
    ['no email', () => bearer({ claims: { email: '' } })],
    ['no sid', () => bearer({ claims: { sid: undefined } })],
  ];

  it.each(refused)('refuses %s with 401 TOKEN_EXPIRED, and no hint why', async (_name, header) => {
    const res = await call(await header()).expect(401);
    expect(res.body).toEqual({ code: 'TOKEN_EXPIRED', message: expect.any(String) });
  });

  it('refuses every portal route, not just one', async () => {
    for (const path of ['/portal/me', '/portal/requests', '/portal/credits', '/portal/layouts']) {
      await request(app.getHttpServer()).get(path).expect(401);
    }
  });

  it('leaves /health open', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });

  it('only accepts ES256', async () => {
    const options: TokenOptions = {};
    const token = await signToken(options);
    // Same claims, header re-labelled as HS256: must not verify.
    const [, payload, signature] = token.split('.');
    const hs = Buffer.from(JSON.stringify({ alg: 'HS256', kid: 'test' })).toString('base64url');
    await call(`Bearer ${hs}.${payload}.${signature}`).expect(401);
  });
});
