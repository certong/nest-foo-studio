import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';

/** vitest.config.mts and vitest.db.config.mts set AUTH_ISSUER to this. */
export const TEST_ISSUER = 'http://auth.test';

const keys = generateKeyPair('ES256');

/** A local key set standing in for nest-foo-auth's JWKS, so no test touches the network. */
export async function testJwks(): Promise<JWTVerifyGetKey> {
  const { publicKey } = await keys;
  return createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'test', alg: 'ES256' }] });
}

export interface TokenOptions {
  claims?: Record<string, unknown>;
  audience?: string;
  issuer?: string;
  expiresIn?: string;
  /** Sign with a key the JWKS does not know. */
  foreignKey?: boolean;
}

/**
 * An access token shaped like nest-foo-auth's (session-token.ts): sub, email,
 * sid, typ, account_type, client_id; ES256; aud = the portal.
 */
export async function signToken(options: TokenOptions = {}): Promise<string> {
  const { privateKey } = options.foreignKey ? await generateKeyPair('ES256') : await keys;
  return new SignJWT({
    email: 'mei@kopilane.com',
    sid: 'session-1',
    typ: 'access',
    account_type: 'client',
    client_id: 9001,
    ...options.claims,
  })
    .setProtectedHeader({ alg: 'ES256', kid: 'test' })
    .setSubject('0199e5a8-0000-7000-8000-00000000acc1')
    .setIssuer(options.issuer ?? TEST_ISSUER)
    .setAudience(options.audience ?? 'studio')
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? '15m')
    .sign(privateKey);
}

/** "Bearer <token>" for a Kopi Lane client, or with the given changes. */
export async function bearer(options?: TokenOptions): Promise<string> {
  return `Bearer ${await signToken(options)}`;
}
