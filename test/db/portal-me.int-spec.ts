import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { seed } from '../../prisma/seed';
import { MeResponse } from '../../src/contract/requests';
import { MeService } from '../../src/portal/me/me.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { bearer } from '../auth-tokens';
import { createTestApp } from '../create-test-app';
import { createThrowawayDatabase, HAS_DATABASE, type ThrowawayDatabase } from './throwaway-database';

const KOPI_LANE = 9001;

describe.skipIf(!HAS_DATABASE)('GET /portal/me against the seeded database (FS-86)', () => {
  let db: ThrowawayDatabase;
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    db = await createThrowawayDatabase();
    await seed(db.prisma, KOPI_LANE);
    prisma = db.prisma as unknown as PrismaService;
    app = await createTestApp({ prisma });
    // resetOn depends on the date: pin it to State B's October.
    app.get(MeService).clock = () => new Date('2026-10-16T03:00:00Z');
  });

  afterAll(async () => {
    await app?.close();
    await db?.drop();
  });

  /** GET /portal/me as a client of `clientId`, expecting `status`. */
  const me = async (status: number, clientId = KOPI_LANE) => {
    const authorization = await bearer({ claims: { client_id: clientId, email: 'mei@kopilane.com' } });
    return request(app.getHttpServer()).get('/portal/me').set('Authorization', authorization).expect(status);
  };

  it('renders the top bar for Kopi Lane from one call: State B', async () => {
    const res = await me(200);
    const request43 = await db.prisma.request.findUniqueOrThrow({
      where: { workspaceId_number: { workspaceId: KOPI_LANE, number: 43 } },
    });
    expect(res.body).toEqual({
      // No billing.client_directory in a test database (CP-101), so the email's local part.
      account: { name: 'mei', email: 'mei@kopilane.com' },
      workspace: { name: 'Kopi Lane', status: 'active', site: 'kopilane.com' },
      credits: {
        free: 220,
        monthly: { free: 125, grant: 200, used: 55, resetOn: '2026-11-01' },
        topup: { free: 95, neverExpires: true },
        held: 20,
        heldFor: [{ requestId: request43.id, requestNumber: 43, credits: 20 }],
      },
    });
    expect(() => MeResponse.parse(res.body)).not.toThrow();
  });

  it('a client that has not been onboarded gets 404 NOT_FOUND', async () => {
    const res = await me(404, 424242);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('serves repeat calls from the cache, and invalidate() reads fresh', async () => {
    const service = app.get(MeService);
    service.invalidate(KOPI_LANE);
    const findFirst = vi.spyOn(db.prisma.workspace, 'findFirst');
    try {
      await me(200);
      await me(200);
      await me(200);
      expect(findFirst).toHaveBeenCalledTimes(1);

      // A credit write elsewhere (FS-92) would do this in the same transaction.
      await db.prisma.workspace.update({ where: { id: KOPI_LANE }, data: { topupBalance: 195 } });
      expect((await me(200)).body.credits.free).toBe(220);
      service.invalidate(KOPI_LANE);
      expect((await me(200)).body.credits.free).toBe(320);
      expect(findFirst).toHaveBeenCalledTimes(2);
    } finally {
      findFirst.mockRestore();
      await db.prisma.workspace.update({ where: { id: KOPI_LANE }, data: { topupBalance: 95 } });
      service.invalidate(KOPI_LANE);
    }
  });

  it('uses the billing contact name once client_directory exists (CP-101)', async () => {
    await db.prisma.$executeRawUnsafe('CREATE SCHEMA billing');
    await db.prisma.$executeRawUnsafe(
      `CREATE VIEW billing.client_directory AS SELECT ${KOPI_LANE} AS id, 'Kopi Lane'::text AS name, 'Mei Ling'::text AS contact_name, 'hello@kopilane.com'::text AS email, 'active'::text AS status`,
    );
    try {
      app.get(MeService).invalidate(KOPI_LANE);
      const res = await me(200);
      expect(res.body.account).toEqual({ name: 'Mei Ling', email: 'mei@kopilane.com' });
    } finally {
      await db.prisma.$executeRawUnsafe('DROP SCHEMA billing CASCADE');
      app.get(MeService).invalidate(KOPI_LANE);
    }
  });
});
