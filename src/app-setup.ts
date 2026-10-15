import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requireUrl } from './auth/jwks.provider';
import { corsOptions, parseOrigins } from './common/cors';

/**
 * Everything main.ts does to the app between create and listen. The test app
 * calls this too, so an endpoint test cannot pass against an app wired
 * differently from the one deployed. scripts/generate-openapi.ts does not: it
 * never serves a request, so it needs no environment.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  // Checked here, at real boot, so a typo stops the server instead of failing
  // every portal call. (The guard reads them lazily: npm run openapi needs neither.)
  requireUrl(config, 'AUTH_ISSUER');
  requireUrl(config, 'AUTH_JWKS_URL');
  app.enableCors(corsOptions(parseOrigins(config.get<string>('STUDIO_WEB_ORIGINS')), config.get<string>('CORS_MAX_AGE')));
}
