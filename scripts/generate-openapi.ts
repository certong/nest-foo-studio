/**
 * Writes openapi.json at the repo root: the contract FE generates its types
 * and mocks from. Boots the app without listening; nothing touches a database.
 *
 *   npm run openapi
 *
 * test/openapi.e2e-spec.ts fails when the committed file is out of date.
 */
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { buildOpenApiDocument } from '../src/openapi';

export const OPENAPI_PATH = join(__dirname, '..', 'openapi.json');

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const doc = buildOpenApiDocument(app);
  await app.close();
  writeFileSync(OPENAPI_PATH, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`wrote ${OPENAPI_PATH} (${Object.keys(doc.paths).length} paths)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
