import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from '../src/app.module';

/** Header a test sets to act as a signed-in client; stands in for the FS-86 JWKS guard. */
export const TEST_CLIENT_HEADER = 'x-test-client-id';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.use((req: Request & { user?: unknown }, _res: Response, next: NextFunction) => {
    const clientId = req.header(TEST_CLIENT_HEADER);
    if (clientId) req.user = { accountType: 'client', clientId: Number(clientId) };
    next();
  });
  await app.init();
  return app;
}
