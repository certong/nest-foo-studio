import type { PrismaClient } from '@prisma/client';
import { seed, STATE_B } from '../../prisma/seed';
import { createThrowawayDatabase, HAS_DATABASE, type ThrowawayDatabase } from './throwaway-database';

const TABLES = [
  'workspace', 'site', 'site_manifest', 'request', 'request_event', 'chat_message', 'attachment', 'patch',
  'check_run', 'credit_ledger', 'topup_request', 'ai_budget', 'ai_reservation', 'ai_usage', 'agent', 'task',
  'setting', 'audit_log',
];
const APPEND_ONLY = ['credit_ledger', 'request_event', 'ai_usage', 'audit_log'];

const KOPI_LANE = 9001;
const OTHER = 9002;

/**
 * The Postgres error code the statements fail with, or null if they all
 * succeed. They run in one transaction (as studio_app when asked) that is
 * always rolled back, so no case changes what the next one sees.
 */
async function failsWith(prisma: PrismaClient, sql: string | string[], role?: 'studio_app'): Promise<string | null> {
  const rollback = new Error('rollback');
  try {
    await prisma.$transaction(async (tx) => {
      if (role) await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
      for (const statement of [sql].flat()) await tx.$executeRawUnsafe(statement);
      throw rollback;
    });
    return null;
  } catch (error) {
    if (error === rollback) return null;
    const meta = (error as { meta?: { code?: string } }).meta;
    const match = /Code: `(\w+)`|code: "?(\w{5})"?/.exec(String((error as Error).message));
    return meta?.code ?? match?.[1] ?? match?.[2] ?? 'unknown';
  }
}

describe.skipIf(!HAS_DATABASE)('studio schema (FS-33)', () => {
  let db: ThrowawayDatabase;
  let prisma: PrismaClient;
  let request43: string;
  let otherSite: string;

  beforeAll(async () => {
    db = await createThrowawayDatabase();
    prisma = db.prisma;
    await seed(prisma, KOPI_LANE);
    request43 = (await prisma.request.findUniqueOrThrow({ where: { workspaceId_number: { workspaceId: KOPI_LANE, number: 43 } } })).id;
    await prisma.workspace.create({ data: { id: OTHER, name: 'Other client', aiCapMicroUsd: 0n } });
    otherSite = (
      await prisma.site.create({
        data: {
          workspaceId: OTHER, domain: 'other.example', repoProvider: 'github', repo: 'x/y', prodBranch: 'main',
          devBranch: 'development', hosting: 'cloudflare_pages', hostingProject: 'other', contentMode: 'block', languages: ['en'],
        },
      })
    ).id;
  });

  afterAll(async () => {
    await db?.drop();
  });

  it('migrate deploy creates all 18 tables in schema studio', async () => {
    const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'studio' AND table_name <> '_prisma_migrations' ORDER BY 1`;
    expect(rows.map((r) => r.table_name).sort()).toEqual([...TABLES].sort());
  });

  describe('append-only tables refuse studio_app UPDATE and DELETE', () => {
    it.each(APPEND_ONLY)('%s', async (table) => {
      expect(await failsWith(prisma, `UPDATE studio.${table} SET created_at = created_at`, 'studio_app')).toBe('42501');
      expect(await failsWith(prisma, `DELETE FROM studio.${table}`, 'studio_app')).toBe('42501');
    });

    it('but studio_app can still read and insert into them', async () => {
      expect(await failsWith(prisma, 'SELECT count(*) FROM studio.credit_ledger', 'studio_app')).toBeNull();
      expect(
        await failsWith(
          prisma,
          `INSERT INTO studio.credit_ledger (workspace_id, kind, bucket, credits, idem_key)
           VALUES (${KOPI_LANE}, 'adjust', 'grant', -1, 'test:insert')`,
          'studio_app',
        ),
      ).toBeNull();
    });

    it('and can update an ordinary table', async () => {
      expect(await failsWith(prisma, `UPDATE studio.request SET title = title WHERE id = '${request43}'`, 'studio_app')).toBeNull();
    });

    it('and cannot touch _prisma_migrations', async () => {
      expect(await failsWith(prisma, 'SELECT count(*) FROM studio._prisma_migrations', 'studio_app')).toBe('42501');
    });
  });

  describe('tenant safety', () => {
    it("a request cannot point at another workspace's site (composite FK)", async () => {
      const code = await failsWith(
        prisma,
        `INSERT INTO studio.request (workspace_id, site_id, number, title, type)
         VALUES (${KOPI_LANE}, '${otherSite}', 99, 'Sneaky', 'change')`,
      );
      expect(code).toBe('23503');
    });

    it("a chat message cannot attach to another workspace's request", async () => {
      const code = await failsWith(
        prisma,
        `INSERT INTO studio.chat_message (request_id, workspace_id, seq, role, content)
         VALUES ('${request43}', ${OTHER}, 99, 'client', 'hi')`,
      );
      expect(code).toBe('23503');
    });

    it('request numbers are unique per workspace, not globally', async () => {
      expect(
        await failsWith(prisma, `INSERT INTO studio.request (workspace_id, site_id, number, title, type) VALUES (${OTHER}, '${otherSite}', 43, 'Also #43', 'change')`),
      ).toBeNull();
      const siteId = (await prisma.site.findFirstOrThrow({ where: { workspaceId: KOPI_LANE } })).id;
      expect(
        await failsWith(prisma, `INSERT INTO studio.request (workspace_id, site_id, number, title, type) VALUES (${KOPI_LANE}, '${siteId}', 43, 'Dup #43', 'change')`),
      ).toBe('23505');
    });
  });

  describe('CHECKs', () => {
    it('close_reason is refused unless the request is closed', async () => {
      expect(await failsWith(prisma, `UPDATE studio.request SET close_reason = 'no_reply' WHERE id = '${request43}'`)).toBe('23514');
    });

    it('a closed request must say why', async () => {
      expect(await failsWith(prisma, `UPDATE studio.request SET status = 'closed' WHERE id = '${request43}'`)).toBe('23514');
      expect(await failsWith(prisma, `UPDATE studio.request SET status = 'closed', close_reason = 'no_reply' WHERE id = '${request43}'`)).toBeNull();
    });

    it('credits held can never exceed the two buckets', async () => {
      expect(await failsWith(prisma, `UPDATE studio.workspace SET credits_held = 241 WHERE id = ${KOPI_LANE}`)).toBe('23514');
      expect(await failsWith(prisma, `UPDATE studio.workspace SET credits_held = 240 WHERE id = ${KOPI_LANE}`)).toBeNull();
    });

    it('no bucket goes negative', async () => {
      expect(await failsWith(prisma, `UPDATE studio.workspace SET topup_balance = -1 WHERE id = ${KOPI_LANE}`)).toBe('23514');
    });

    it('a request event has exactly one actor', async () => {
      const both = `INSERT INTO studio.request_event (request_id, workspace_id, to_status, actor_account_id, actor_agent)
                    VALUES ('${request43}', ${KOPI_LANE}, 'uat', 'acc', 'studio')`;
      const none = `INSERT INTO studio.request_event (request_id, workspace_id, to_status) VALUES ('${request43}', ${KOPI_LANE}, 'uat')`;
      expect(await failsWith(prisma, both)).toBe('23514');
      expect(await failsWith(prisma, none)).toBe('23514');
    });

    it('a ledger idempotency key is used once per workspace', async () => {
      expect(
        await failsWith(prisma, `INSERT INTO studio.credit_ledger (workspace_id, kind, bucket, credits, period, idem_key) VALUES (${KOPI_LANE}, 'grant', 'grant', 200, '2026-10', 'grant:2026-10')`),
      ).toBe('23505');
    });

    it('one working task per agent', async () => {
      const agent = (await prisma.agent.findFirstOrThrow({ where: { name: 'ba' } })).id;
      const task = (status: string) =>
        `INSERT INTO studio.task (workspace_id, agent_id, title, public_label, status) VALUES (${KOPI_LANE}, '${agent}', 't', 'p', '${status}')`;
      expect(await failsWith(prisma, [task('working'), task('working')])).toBe('23505');
      expect(await failsWith(prisma, [task('working'), task('queued')])).toBeNull();
    });
  });

  describe('seed: Kopi Lane State B', () => {
    it('caches the balances State B shows', async () => {
      const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: KOPI_LANE } });
      expect({ grant: ws.grantBalance, topup: ws.topupBalance, held: ws.creditsHeld }).toEqual({
        grant: STATE_B.grantBalance,
        topup: STATE_B.topupBalance,
        held: STATE_B.creditsHeld,
      });
      expect(ws.grantBalance + ws.topupBalance - ws.creditsHeld).toBe(STATE_B.free);
    });

    it('the ledger rebuilds those balances, and October used 55', async () => {
      const sums = await prisma.creditLedger.groupBy({ by: ['bucket'], where: { workspaceId: KOPI_LANE }, _sum: { credits: true } });
      const byBucket = Object.fromEntries(sums.map((s) => [s.bucket, s._sum.credits]));
      expect(byBucket).toEqual({ grant: STATE_B.grantBalance, topup: STATE_B.topupBalance });

      const used = await prisma.creditLedger.aggregate({
        where: { workspaceId: KOPI_LANE, kind: 'usage', createdAt: { gte: new Date('2026-10-01T00:00:00Z') } },
        _sum: { credits: true },
      });
      expect(-(used._sum.credits ?? 0)).toBe(STATE_B.usedThisMonth);
    });

    it('holds match: the workspace total is the sum of request holds', async () => {
      const held = await prisma.request.aggregate({ where: { workspaceId: KOPI_LANE }, _sum: { creditsHeld: true } });
      expect(held._sum.creditsHeld).toBe(STATE_B.creditsHeld);
    });

    it('has requests #37–#43 with the statuses the mock-up shows', async () => {
      const rows = await prisma.request.findMany({ where: { workspaceId: KOPI_LANE }, orderBy: { number: 'asc' } });
      expect(rows.map((r) => `${r.number}:${r.status}${r.closeReason ? `/${r.closeReason}` : ''}`)).toEqual([
        '37:pending_chi', '38:live', '39:closed/client_cancelled', '40:live', '41:uat', '42:building', '43:uat',
      ]);
    });

    it('every request has a history ending at its status, so the tracker knows where it stopped', async () => {
      const events = await prisma.requestEvent.findMany({ where: { workspaceId: KOPI_LANE }, orderBy: { createdAt: 'asc' } });
      const requests = await prisma.request.findMany({ where: { workspaceId: KOPI_LANE } });
      for (const r of requests) {
        const mine = events.filter((e) => e.requestId === r.id);
        expect(mine.at(-1)?.toStatus, `#${r.number}`).toBe(r.status);
      }
      const events37 = events.filter((e) => e.requestId === requests.find((r) => r.number === 37)!.id);
      expect(events37.at(-1)?.fromStatus).toBe('checking');
    });

    it('starts the 4 agents', async () => {
      const agents = await prisma.agent.findMany({ orderBy: { name: 'asc' } });
      expect(agents.map((a) => a.name)).toEqual(['backend-dev', 'ba', 'frontend-dev', 'reviewer'].sort());
    });

    it('running it again changes nothing', async () => {
      expect(await seed(prisma, KOPI_LANE)).toBe('exists');
    });
  });
});
