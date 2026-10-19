import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { seed } from '../../prisma/seed';
import { CreditsService } from '../../src/credits/credits.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { bearer } from '../auth-tokens';
import { createTestApp } from '../create-test-app';
import { createDraft, createWorkspace, error } from './credits-fixtures';
import { createThrowawayDatabase, HAS_DATABASE, type ThrowawayDatabase } from './throwaway-database';

const KOPI_LANE = 9001;
const ACTOR = 'test:actor';

describe.skipIf(!HAS_DATABASE)('CreditsService (FS-92)', () => {
  let db: ThrowawayDatabase;
  let app: INestApplication;
  let credits: CreditsService;

  beforeAll(async () => {
    db = await createThrowawayDatabase();
    await seed(db.prisma, KOPI_LANE);
    app = await createTestApp({ prisma: db.prisma as unknown as PrismaService });
    credits = app.get(CreditsService);
    // resetOn in a 402 depends on the date: the last day of State B's October.
    credits.clock = () => new Date('2026-10-31T10:00:00Z');
  });

  afterAll(async () => {
    await app?.close();
    await db?.drop();
  });

  const scopeFor = (workspaceId: number, requestId: string) => ({ workspaceId, requestId, actor: ACTOR });
  /** The StudioException a credit operation rejects with; fails the test if it resolved. */
  const failureOf = async (operation: Promise<unknown>) => {
    try {
      await operation;
    } catch (e) {
      return error(e);
    }
    throw new Error('expected the operation to be refused');
  };
  const workspace = (id: number) =>
    db.prisma.workspace.findUniqueOrThrow({ where: { id }, select: { grantBalance: true, topupBalance: true, creditsHeld: true } });
  const requestRow = (id: string) =>
    db.prisma.request.findUniqueOrThrow({ where: { id }, select: { creditsHeld: true, creditsPrice: true } });

  describe('hold', () => {
    it('sets the hold on the request and the workspace, and records the price', async () => {
      await createWorkspace(db.prisma, 9101, { grantBalance: 100, topupBalance: 0 });
      const draft = await createDraft(db.prisma, 9101, 1);

      const result = await credits.run(9101, (tx) => credits.hold(tx, scopeFor(9101, draft), 'change'));

      expect(result).toEqual({ price: 20, held: 20 });
      expect(await requestRow(draft)).toEqual({ creditsHeld: 20, creditsPrice: 20 });
      expect(await workspace(9101)).toEqual({ grantBalance: 100, topupBalance: 0, creditsHeld: 20 });
    });

    it('holding again on the same request changes nothing', async () => {
      const draft = (await db.prisma.request.findFirstOrThrow({ where: { workspaceId: 9101, number: 1 } })).id;

      await credits.run(9101, (tx) => credits.hold(tx, scopeFor(9101, draft), 'change'));

      expect(await workspace(9101)).toMatchObject({ creditsHeld: 20 });
      expect(await requestRow(draft)).toEqual({ creditsHeld: 20, creditsPrice: 20 });
    });

    it('refuses with 402 and the details the screen needs', async () => {
      await createWorkspace(db.prisma, 9102, { grantBalance: 10, topupBalance: 0 });
      const draft = await createDraft(db.prisma, 9102, 1);

      const failure = await failureOf(credits.run(9102, (tx) => credits.hold(tx, scopeFor(9102, draft), 'change')));

      expect(failure).toEqual({
        code: 'NOT_ENOUGH_CREDITS',
        details: { needed: 20, have: 10, short: 10, resetOn: '2026-11-01', draftId: draft },
      });
      expect(await workspace(9102)).toMatchObject({ creditsHeld: 0 });
    });

    it('two tabs holding at once cannot both pass', async () => {
      await createWorkspace(db.prisma, 9103, { grantBalance: 25, topupBalance: 0 });
      const [a, b] = [await createDraft(db.prisma, 9103, 1), await createDraft(db.prisma, 9103, 2)];

      const outcomes = await Promise.allSettled([
        credits.run(9103, (tx) => credits.hold(tx, scopeFor(9103, a), 'change')),
        credits.run(9103, (tx) => credits.hold(tx, scopeFor(9103, b), 'change')),
      ]);

      expect(outcomes.map((o) => o.status).sort()).toEqual(['fulfilled', 'rejected']);
      const rejected = outcomes.find((o) => o.status === 'rejected') as PromiseRejectedResult;
      expect(error(rejected.reason).code).toBe('NOT_ENOUGH_CREDITS');
      expect(await workspace(9103)).toMatchObject({ creditsHeld: 20 });
    });

    it('a read-only workspace gets 403', async () => {
      await createWorkspace(db.prisma, 9104, { grantBalance: 100, topupBalance: 0 }, 'read_only');
      const draft = await createDraft(db.prisma, 9104, 1);

      const failure = await failureOf(credits.run(9104, (tx) => credits.hold(tx, scopeFor(9104, draft), 'change')));

      expect(failure.code).toBe('WORKSPACE_READ_ONLY');
    });

    it('a request of another workspace gets 404', async () => {
      await createWorkspace(db.prisma, 9105, { grantBalance: 100, topupBalance: 0 });
      const foreign = (await db.prisma.request.findFirstOrThrow({ where: { workspaceId: 9101, number: 1 } })).id;

      const failure = await failureOf(credits.run(9105, (tx) => credits.hold(tx, scopeFor(9105, foreign), 'change')));

      expect(failure.code).toBe('NOT_FOUND');
    });

    it('a soft-deleted workspace gets 404', async () => {
      await createWorkspace(db.prisma, 9106, { grantBalance: 100, topupBalance: 0 });
      const draft = await createDraft(db.prisma, 9106, 1);
      await db.prisma.workspace.update({ where: { id: 9106 }, data: { deletedAt: new Date() } });

      const failure = await failureOf(credits.run(9106, (tx) => credits.hold(tx, scopeFor(9106, draft), 'change')));

      expect(failure.code).toBe('NOT_FOUND');
    });

    it('a closed request gets 409', async () => {
      await createWorkspace(db.prisma, 9107, { grantBalance: 100, topupBalance: 0 });
      const closed = await createDraft(db.prisma, 9107, 1, { status: 'closed', closeReason: 'client_cancelled' });

      const failure = await failureOf(credits.run(9107, (tx) => credits.hold(tx, scopeFor(9107, closed), 'change')));

      expect(failure.code).toBe('INVALID_STATE');
    });

    it('invalidates /portal/me after the commit', async () => {
      const me = async () => {
        const authorization = await bearer({ claims: { client_id: KOPI_LANE, email: 'mei@kopilane.com' } });
        return (await request(app.getHttpServer()).get('/portal/me').set('Authorization', authorization).expect(200)).body;
      };
      expect((await me()).credits.held).toBe(20); // cached from here on
      const draft = await createDraft(db.prisma, KOPI_LANE, 44);

      await credits.run(KOPI_LANE, (tx) => credits.hold(tx, scopeFor(KOPI_LANE, draft), 'change'));

      const after = await me();
      expect(after.credits.held).toBe(40);
      expect(after.credits.heldFor).toContainEqual({ requestId: draft, requestNumber: 44, credits: 20 });
    });
  });
});
