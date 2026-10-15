/**
 * Kopi Lane, "State B": the data react-foo-studio's mock and the Claude Design
 * mock-up show (FS-33).
 *
 *   October: +200 monthly, 95 top-up carried over from August,
 *            −20 (#38 change), −15 (#39 page draft dropped), −20 (#40 change),
 *            20 held for #43
 *   → grant_balance 145, topup_balance 95, credits_held 20, 220 free, 55 used
 *
 *   npm run seed                       # into DATABASE_URL's studio schema
 *   SEED_WORKSPACE_ID=2 npm run seed   # as an existing billing client
 *
 * workspace.id must equal a billing client id (and the auth token's client_id)
 * for a real sign-in to land on it. Kopi Lane is not a billing client, so the
 * default is 9001, a demo id; point SEED_WORKSPACE_ID at a real client to sign in.
 * Runs once: if the workspace exists, it changes nothing.
 */
import { Prisma, PrismaClient, RequestStatus, RequestType } from '@prisma/client';

export const STATE_B = { grantBalance: 145, topupBalance: 95, creditsHeld: 20, free: 220, usedThisMonth: 55 };

const FX_MYR_PER_USD = 4.7;
const PERIOD = '2026-10';

/** RM → micro-USD, rounded up so a cap is never under-counted. */
function rmToMicroUsd(rm: number): bigint {
  return BigInt(Math.ceil((rm / FX_MYR_PER_USD) * 1_000_000));
}

const at = (iso: string): Date => new Date(iso);

interface SeedRequest {
  number: number;
  type: RequestType;
  title: string;
  /** Every status it passed through, oldest first; the last one is where it is now. */
  path: Array<[RequestStatus, string]>;
  closeReason?: 'client_cancelled' | 'no_reply' | 'agent_closed';
  creditsPrice?: number;
  creditsHeld?: number;
  remark?: string;
}

const REQUESTS: SeedRequest[] = [
  {
    number: 37,
    type: 'new_page',
    title: 'Events',
    path: [['draft', '2026-09-29T02:00:00Z'], ['submitted', '2026-10-01T03:00:00Z'], ['building', '2026-10-01T03:05:00Z'], ['checking', '2026-10-06T08:00:00Z'], ['pending_chi', '2026-10-06T08:20:00Z']],
    remark: "A check didn't pass. Chi is on it. Nothing went live.",
  },
  {
    number: 38,
    type: 'change',
    title: 'Menu prices for the new season',
    path: [['draft', '2026-10-02T04:00:00Z'], ['checking', '2026-10-03T02:00:00Z'], ['live', '2026-10-03T02:10:00Z']],
    creditsPrice: 20,
  },
  {
    number: 39,
    type: 'new_page',
    title: 'Gift cards',
    path: [['draft', '2026-10-05T06:00:00Z'], ['closed', '2026-10-07T09:00:00Z']],
    closeReason: 'client_cancelled',
    creditsPrice: 15,
  },
  {
    number: 40,
    type: 'change',
    title: 'About us text',
    path: [['draft', '2026-10-09T05:00:00Z'], ['checking', '2026-10-10T03:00:00Z'], ['live', '2026-10-10T03:12:00Z']],
    creditsPrice: 20,
  },
  {
    number: 41,
    type: 'new_page',
    title: 'Catering',
    path: [['draft', '2026-10-02T07:00:00Z'], ['submitted', '2026-10-08T02:00:00Z'], ['building', '2026-10-08T02:05:00Z'], ['checking', '2026-10-13T01:00:00Z'], ['uat', '2026-10-13T01:30:00Z']],
  },
  {
    number: 42,
    type: 'new_page',
    title: 'Our Story',
    path: [['draft', '2026-10-09T08:00:00Z'], ['submitted', '2026-10-13T03:00:00Z'], ['building', '2026-10-13T03:05:00Z']],
  },
  {
    number: 43,
    type: 'change',
    title: 'Opening hours and WhatsApp',
    path: [['draft', '2026-10-14T00:30:00Z'], ['checking', '2026-10-14T00:55:00Z'], ['uat', '2026-10-14T01:00:00Z']],
    creditsPrice: 20,
    creditsHeld: 20,
  },
];

const AGENTS = [
  { name: 'ba', role: 'Business analyst: turns a client chat into changes or a page plan', model: 'claude-haiku-5-5', pipelineStep: 'ba', skills: ['requirements', 'copy'], tools: ['manifest'] },
  { name: 'backend-dev', role: 'Developer: applies patches and builds pages', model: 'claude-sonnet-5-5', pipelineStep: 'dev', skills: ['nestjs', 'content'], tools: ['github'] },
  { name: 'frontend-dev', role: 'Developer: page blocks and layout', model: 'claude-sonnet-5-5', pipelineStep: 'dev', skills: ['react', 'css'], tools: ['github', 'cloudflare'] },
  { name: 'reviewer', role: 'Reviewer: checks a change before it goes live', model: 'claude-sonnet-5-5', pipelineStep: 'review', skills: ['review'], tools: ['github'] },
];

export async function seed(prisma: PrismaClient, workspaceId: number): Promise<'seeded' | 'exists'> {
  if (await prisma.workspace.findUnique({ where: { id: workspaceId } })) return 'exists';

  await prisma.$transaction(async (tx) => {
    await tx.setting.createMany({
      data: [
        { key: 'credit_prices', value: { change: 20, drop: 15, extra_preview: 10 } },
        { key: 'monthly_grant', value: 200 },
        { key: 'topup_pack', value: { credits: 100, priceSen: 2000 } },
        { key: 'fx_myr_per_usd', value: FX_MYR_PER_USD },
      ],
      skipDuplicates: true,
    });

    for (const agent of AGENTS) {
      const exists = await tx.agent.findFirst({ where: { name: agent.name, deletedAt: null } });
      if (!exists) await tx.agent.create({ data: agent });
    }

    await tx.workspace.create({
      data: {
        id: workspaceId,
        name: 'Kopi Lane',
        grantBalance: STATE_B.grantBalance,
        topupBalance: STATE_B.topupBalance,
        creditsHeld: STATE_B.creditsHeld,
        // Month cap: RM 7 + RM 10 per 100 top-up credits bought (one pack in August).
        aiCapMicroUsd: rmToMicroUsd(7 + 10),
      },
    });

    const site = await tx.site.create({
      data: {
        workspaceId,
        domain: workspaceId === 9001 ? 'kopilane.com' : `kopilane-${workspaceId}.example`,
        repoProvider: 'github',
        repo: 'certong/kopilane-site',
        prodBranch: 'main',
        devBranch: 'development',
        hosting: 'cloudflare_pages',
        hostingProject: 'kopilane',
        contentMode: 'keyed',
        languages: ['en', 'ms', 'zh'],
      },
    });

    const ids = new Map<number, string>();
    for (const r of REQUESTS) {
      const [status, lastAt] = r.path[r.path.length - 1]!;
      const created = await tx.request.create({
        data: {
          workspaceId,
          siteId: site.id,
          number: r.number,
          title: r.title,
          type: r.type,
          status,
          closeReason: r.closeReason ?? null,
          creditsPrice: r.creditsPrice ?? 0,
          creditsHeld: r.creditsHeld ?? 0,
          remark: r.remark ?? null,
          uatSentAt: status === 'uat' ? at(lastAt) : null,
          liveAt: status === 'live' ? at(lastAt) : null,
          createdAt: at(r.path[0]![1]),
        },
      });
      ids.set(r.number, created.id);
      await tx.requestEvent.createMany({
        data: r.path.map(([to, when], i) => ({
          requestId: created.id,
          workspaceId,
          fromStatus: i === 0 ? null : r.path[i - 1]![0],
          toStatus: to,
          // The client opens and drops drafts; everything else is the agent side.
          ...(to === 'draft' || r.closeReason === 'client_cancelled'
            ? { actorAccountId: 'seed:kopilane-client' }
            : { actorAgent: 'studio' }),
          createdAt: at(when),
        })),
      });
    }

    const topup = await tx.topupRequest.create({
      data: { workspaceId, pack: 100, credits: 100, amountSen: 2000n, status: 'approved', billingRef: `seed-${workspaceId}-2026-08`, createdAt: at('2026-08-20T03:00:00Z') },
    });

    const ledger: Array<Omit<Prisma.CreditLedgerCreateManyInput, 'workspaceId'>> = [
      // August: one top-up pack, 5 of it used. Top-ups never expire.
      { kind: 'topup', bucket: 'topup', credits: 100, topupRequestId: topup.id, idemKey: `topup:${topup.id}`, createdAt: at('2026-08-21T02:00:00Z') },
      { kind: 'usage', bucket: 'topup', credits: -5, idemKey: 'usage:2026-08:carried', createdAt: at('2026-08-29T02:00:00Z') },
      // October.
      { kind: 'grant', bucket: 'grant', credits: 200, period: PERIOD, idemKey: `grant:${PERIOD}`, createdAt: at('2026-10-01T00:05:00Z') },
      { kind: 'usage', bucket: 'grant', credits: -20, requestId: ids.get(38)!, idemKey: `usage:${ids.get(38)}:change`, createdAt: at('2026-10-03T02:10:00Z') },
      { kind: 'usage', bucket: 'grant', credits: -15, requestId: ids.get(39)!, idemKey: `usage:${ids.get(39)}:drop`, createdAt: at('2026-10-07T09:00:00Z') },
      { kind: 'usage', bucket: 'grant', credits: -20, requestId: ids.get(40)!, idemKey: `usage:${ids.get(40)}:change`, createdAt: at('2026-10-10T03:12:00Z') },
    ];
    await tx.creditLedger.createMany({ data: ledger.map((row) => ({ ...row, workspaceId, createdBy: 'seed' })) });

    await tx.aiBudget.create({
      data: { workspaceId, scope: 'month', period: PERIOD, capMicroUsd: rmToMicroUsd(7 + 10) },
    });

    const chat = ids.get(43)!;
    await tx.chatMessage.createMany({
      data: [
        { requestId: chat, workspaceId, seq: 1, role: 'ba', content: 'What would you like to change?', createdAt: at('2026-10-14T00:30:00Z') },
        { requestId: chat, workspaceId, seq: 2, role: 'client', content: 'New opening hours: 7am–7pm, closed Tuesdays. And the WhatsApp number is now 012-345 6789.', createdAt: at('2026-10-14T00:31:00Z') },
        { requestId: chat, workspaceId, seq: 3, role: 'ba', content: 'Got it. Hours on Home and Visit us both change, plus the WhatsApp button on every page.', createdAt: at('2026-10-14T00:31:30Z') },
      ],
    });
  });

  return 'seeded';
}

async function main(): Promise<void> {
  const workspaceId = Number(process.env.SEED_WORKSPACE_ID ?? 9001);
  if (!Number.isInteger(workspaceId) || workspaceId <= 0) throw new Error('SEED_WORKSPACE_ID must be a positive integer');
  const prisma = new PrismaClient();
  try {
    const result = await seed(prisma, workspaceId);
    console.log(result === 'seeded' ? `seeded Kopi Lane as workspace ${workspaceId}` : `workspace ${workspaceId} already exists; nothing changed`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
