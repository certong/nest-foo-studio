import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';

/** Injection token for nest-foo-auth's public key set. */
export const JWKS = Symbol('JWKS');

/**
 * A required setting that must be an absolute URL. Returned as written:
 * AUTH_ISSUER is compared to the token's `iss` character for character.
 */
export function requireUrl(config: ConfigService, name: string): string {
  const value = config.get<string>(name);
  if (!value || !URL.canParse(value)) {
    throw new Error(`${name} must be an absolute URL`);
  }
  return value;
}

/**
 * The key set the guard verifies against, as in nest-foo-billing. jose caches
 * it and re-fetches only for a kid it has not seen (cooldown 30 s, max age
 * 10 min, which nest-foo-auth's key rotation waits out).
 *
 * Built on first use rather than at boot, so `npm run openapi` and the unit
 * suite need no AUTH_* settings. configureApp() checks them when the server
 * really starts. Tests swap this provider for a local key set.
 */
export const jwksProvider = {
  provide: JWKS,
  inject: [ConfigService],
  useFactory: (config: ConfigService): JWTVerifyGetKey => {
    let remote: JWTVerifyGetKey | undefined;
    return (header, token) => {
      remote ??= createRemoteJWKSet(new URL(requireUrl(config, 'AUTH_JWKS_URL')));
      return remote(header, token);
    };
  },
};
