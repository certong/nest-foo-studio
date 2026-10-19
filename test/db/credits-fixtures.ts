import type { Prisma, PrismaClient, WorkspaceStatus } from '@prisma/client';
import type { StudioException } from '../../src/common/studio-exception';

/** A workspace with the given cached balances and one site, so drafts can be created on it. */
export async function createWorkspace(
  prisma: PrismaClient,
  id: number,
  balances: { grantBalance: number; topupBalance: number; creditsHeld?: number },
  status: WorkspaceStatus = 'active',
): Promise<{ workspaceId: number; siteId: string }> {
  await prisma.workspace.create({
    data: {
      id,
      name: `Test workspace ${id}`,
      status,
      grantBalance: balances.grantBalance,
      topupBalance: balances.topupBalance,
      creditsHeld: balances.creditsHeld ?? 0,
      aiCapMicroUsd: 0n,
    },
  });
  const site = await prisma.site.create({
    data: {
      workspaceId: id,
      domain: `test-${id}.example`,
      repoProvider: 'github',
      repo: 'certong/test-site',
      prodBranch: 'main',
      devBranch: 'development',
      hosting: 'cloudflare_pages',
      hostingProject: `test-${id}`,
      contentMode: 'block',
      languages: ['en'],
    },
  });
  return { workspaceId: id, siteId: site.id };
}

/** A change draft on the workspace's site, with its first request_event. Returns the id. */
export async function createDraft(
  prisma: PrismaClient,
  workspaceId: number,
  number: number,
  data: Partial<Prisma.RequestUncheckedCreateInput> = {},
): Promise<string> {
  const site = await prisma.site.findFirstOrThrow({ where: { workspaceId }, select: { id: true } });
  const request = await prisma.request.create({
    data: { workspaceId, siteId: site.id, number, title: `Draft #${number}`, type: 'change', status: 'draft', ...data },
  });
  await prisma.requestEvent.create({
    data: { requestId: request.id, workspaceId, fromStatus: null, toStatus: request.status, actorAccountId: 'test:client' },
  });
  return request.id;
}

/** The code and details of a StudioException a promise rejected with. */
export function error(e: unknown): { code: string; details?: unknown } {
  const studio = e as StudioException;
  return { code: studio.code, details: studio.details };
}
