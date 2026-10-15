import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp } from '../src/app-setup';
import { AppModule } from '../src/app.module';
import { JWKS } from '../src/auth/jwks.provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { testJwks } from './auth-tokens';

/**
 * The app as main.ts wires it (configureApp), with nest-foo-auth's key set
 * swapped for a local one: tests send real ES256 tokens (test/auth-tokens.ts)
 * through the real guard. Pass a PrismaService to run against a database.
 */
export async function createTestApp(options: { prisma?: PrismaService } = {}): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(JWKS)
    .useValue(await testJwks());
  if (options.prisma) builder = builder.overrideProvider(PrismaService).useValue(options.prisma);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}
