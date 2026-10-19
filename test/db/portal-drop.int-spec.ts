import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { seed } from '../../prisma/seed';
import { DropResponse } from '../../src/contract/chat';
import { PrismaService } from '../../src/prisma/prisma.service';
import { bearer } from '../auth-tokens';
import { createTestApp } from '../create-test-app';
import { createDraft, createWorkspace } from './credits-fixtures';
import { createThrowawayDatabase, HAS_DATABASE, type ThrowawayDatabase } from './throwaway-database';

const KOPI_LANE = 9001;
/** test/auth-tokens.ts signs every token with this subject. */
const ACCOUNT_ID = '0199e5a8-0000-7000-8000-00000000acc1';

describe.skipIf(!HAS_DATABASE)('POST /portal/requests/:id/drop (FS-92)', () => {
  let db: ThrowawayDatabase;
  let app: INestApplication;

  beforeAll(async () => {
    db = await createThrowawayDatabase();
    await seed(db.prisma, KOPI_LANE);
    app = await createTestApp({ prisma: db.prisma as unknown as PrismaService });
  });

  afterAll(async () => {
    await app?.close();
    await db?.drop();
  });

  /** POST …/drop as a client of `clientId`; `status` asserts the reply code when given. */
  const drop = async (clientId: number, id: string, body: object, status?: number, idempotencyKey: string | null = randomUUID()) => {
    const req = request(app.getHttpServer())
      .post(`/portal/requests/${id}/drop`)
      .set('Authorization', await bearer({ claims: { client_id: clientId } }));
    if (idempotencyKey) req.set('Idempotency-Key', idempotencyKey);
    const sent = req.send(body);
    return status === undefined ? sent : sent.expect(status);
  };
  const workspace = (id: number) =>
    db.prisma.workspace.findUniqueOrThrow({ where: { id }, select: { grantBalance: true, topupBalance: true, creditsHeld: true } });
  const ledgerFor = (requestId: string) =>
    db.prisma.creditLedger.findMany({ where: { requestId }, select: { bucket: true, credits: true, idemKey: true } });

  /** A draft that already holds 20 credits, on a workspace that counts them. */
  const heldDraft = async (workspaceId: number, number: number, status: 'draft' | 'paused' = 'draft') => {
    const id = await createDraft(db.prisma, workspaceId, number, { status, creditsHeld: 20, creditsPrice: 20 });
    await db.prisma.workspace.update({ where: { id: workspaceId }, data: { creditsHeld: { increment: 20 } } });
    return id;
  };

  it('previews the cost of a started draft without touching anything', async () => {
    await createWorkspace(db.prisma, 9201, { grantBalance: 100, topupBalance: 0 });
    const draft = await heldDraft(9201, 1);

    const res = await drop(9201, draft, {}, 200);

    expect(res.body).toEqual({ dropped: false, cost: 15, request: null });
    expect(await workspace(9201)).toEqual({ grantBalance: 100, topupBalance: 0, creditsHeld: 20 });
    expect(await db.prisma.request.findUniqueOrThrow({ where: { id: draft } })).toMatchObject({ status: 'draft', creditsHeld: 20 });
  });

  it('drops a started draft: 15 charged, hold released, closed card', async () => {
    const draft = (await db.prisma.request.findFirstOrThrow({ where: { workspaceId: 9201, number: 1 } })).id;

    const res = await drop(9201, draft, { confirm: true }, 200);

    expect(res.body).toMatchObject({
      dropped: true,
      cost: 15,
      request: { id: draft, status: 'closed', closeReason: 'client_cancelled', badge: 'Cancelled (You)', creditsHeld: 0 },
    });
    expect(() => DropResponse.parse(res.body)).not.toThrow();
    expect(await ledgerFor(draft)).toEqual([{ bucket: 'grant', credits: -15, idemKey: `usage:${draft}:drop` }]);
    expect(await workspace(9201)).toEqual({ grantBalance: 85, topupBalance: 0, creditsHeld: 0 });
    const event = await db.prisma.requestEvent.findFirstOrThrow({ where: { requestId: draft, toStatus: 'closed' } });
    expect(event).toMatchObject({ fromStatus: 'draft', actorAccountId: ACCOUNT_ID, actorAgent: null });
  });

  it('drops a paused draft the same way', async () => {
    const paused = await heldDraft(9201, 2, 'paused');

    const res = await drop(9201, paused, { confirm: true }, 200);

    expect(res.body).toMatchObject({ dropped: true, cost: 15, request: { status: 'closed', closeReason: 'client_cancelled' } });
    expect(await ledgerFor(paused)).toHaveLength(1);
    expect(await workspace(9201)).toEqual({ grantBalance: 70, topupBalance: 0, creditsHeld: 0 });
    const event = await db.prisma.requestEvent.findFirstOrThrow({ where: { requestId: paused, toStatus: 'closed' } });
    expect(event.fromStatus).toBe('paused');
  });

  it('an unstarted draft drops for free: no ledger row', async () => {
    const fresh = await createDraft(db.prisma, 9201, 3);

    const res = await drop(9201, fresh, { confirm: true }, 200);

    expect(res.body).toMatchObject({ dropped: true, cost: 0, request: { status: 'closed' } });
    expect(await ledgerFor(fresh)).toEqual([]);
    expect(await workspace(9201)).toEqual({ grantBalance: 70, topupBalance: 0, creditsHeld: 0 });
  });

  it('a started draft that cannot pay gets 402 with draftId, and stays a draft', async () => {
    await createWorkspace(db.prisma, 9202, { grantBalance: 10, topupBalance: 0 });
    const planned = await createDraft(db.prisma, 9202, 1, { type: 'new_page', pagePlan: { pages: ['Catering'] } });

    const res = await drop(9202, planned, { confirm: true }, 402);

    expect(res.body).toMatchObject({ code: 'NOT_ENOUGH_CREDITS', details: { needed: 15, have: 10, short: 5, draftId: planned } });
    expect(await db.prisma.request.findUniqueOrThrow({ where: { id: planned } })).toMatchObject({ status: 'draft' });
    expect(await workspace(9202)).toEqual({ grantBalance: 10, topupBalance: 0, creditsHeld: 0 });
  });

  it('#43 (uat) gets 409 INVALID_STATE', async () => {
    const uat = (await db.prisma.request.findUniqueOrThrow({ where: { workspaceId_number: { workspaceId: KOPI_LANE, number: 43 } } })).id;

    const res = await drop(KOPI_LANE, uat, { confirm: true }, 409);

    expect(res.body.code).toBe('INVALID_STATE');
  });

  it("another client's draft gets 404", async () => {
    await createWorkspace(db.prisma, 9203, { grantBalance: 100, topupBalance: 0 });
    const foreign = await createDraft(db.prisma, 9201, 4);

    const res = await drop(9203, foreign, { confirm: true }, 404);

    expect(res.body.code).toBe('NOT_FOUND');
    expect(await db.prisma.request.findUniqueOrThrow({ where: { id: foreign } })).toMatchObject({ status: 'draft' });
  });

  it('without Idempotency-Key gets 400 VALIDATION_FAILED', async () => {
    const draft = (await db.prisma.request.findFirstOrThrow({ where: { workspaceId: 9201, number: 4 } })).id;

    const res = await drop(9201, draft, { confirm: true }, 400, null);

    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('two confirmed drops at once: one 200, one 409, one ledger row', async () => {
    await createWorkspace(db.prisma, 9204, { grantBalance: 100, topupBalance: 0 });
    const draft = await heldDraft(9204, 1);

    const [a, b] = await Promise.all([drop(9204, draft, { confirm: true }), drop(9204, draft, { confirm: true })]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await ledgerFor(draft)).toHaveLength(1);
    expect(await workspace(9204)).toEqual({ grantBalance: 85, topupBalance: 0, creditsHeld: 0 });
  });

  it('/portal/me shows the hold gone right after the drop', async () => {
    const me = async () => {
      const authorization = await bearer({ claims: { client_id: KOPI_LANE } });
      return (await request(app.getHttpServer()).get('/portal/me').set('Authorization', authorization).expect(200)).body;
    };
    const draft = await heldDraft(KOPI_LANE, 45);
    expect((await me()).credits.held).toBe(40);

    await drop(KOPI_LANE, draft, { confirm: true }, 200);

    const after = await me();
    expect(after.credits.held).toBe(20);
    expect(after.credits.heldFor.map((h: { requestNumber: number }) => h.requestNumber)).toEqual([43]);
  });
});
