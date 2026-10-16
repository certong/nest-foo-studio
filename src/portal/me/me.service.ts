import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import type { WorkspaceScope } from '../../common/current-workspace.decorator';
import { StudioException } from '../../common/studio-exception';
import type { MeResponse } from '../../contract/requests';
import { PrismaService } from '../../prisma/prisma.service';
import { creditMeter, type CreditsView } from './credit-meter';
import { WorkspaceCache } from './workspace-cache';

type Me = z.infer<typeof MeResponse>;

/** What /portal/me reads from the database: everything but the caller's own account. */
export interface WorkspaceSummary {
  workspace: Me['workspace'];
  credits: CreditsView;
  contactName: string | null;
}

/** Postgres: relation does not exist / permission denied. Both mean CP-101 is not there yet. */
const DIRECTORY_MISSING = new Set(['42P01', '42501']);

@Injectable()
export class MeService {
  /** Replaceable in tests (resetOn depends on the date). */
  clock: () => Date = () => new Date();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: WorkspaceCache<WorkspaceSummary>,
  ) {}

  async me(scope: WorkspaceScope): Promise<Me> {
    const summary = await this.cache.get(scope.clientId, () => this.load(scope.clientId));
    return {
      account: { name: summary.contactName ?? emailName(scope.email), email: scope.email },
      workspace: summary.workspace,
      credits: summary.credits,
    };
  }

  /** For anything that changes credits (FS-92): the next /portal/me reads fresh. */
  invalidate(workspaceId: number): void {
    this.cache.invalidate(workspaceId);
  }

  private async load(workspaceId: number): Promise<WorkspaceSummary> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: {
        name: true,
        status: true,
        grantBalance: true,
        topupBalance: true,
        creditsHeld: true,
        monthlyGrant: true,
        sites: { where: { deletedAt: null }, select: { domain: true }, orderBy: { createdAt: 'asc' }, take: 1 },
        requests: {
          where: { creditsHeld: { gt: 0 } },
          select: { id: true, number: true, creditsHeld: true },
          orderBy: { number: 'asc' },
        },
      },
    });
    // A valid token for a client that has not been onboarded yet.
    if (!workspace) throw new StudioException('NOT_FOUND', undefined, 'No Studio workspace for this account yet');

    return {
      workspace: { name: workspace.name, status: workspace.status, site: workspace.sites[0]?.domain ?? '' },
      credits: creditMeter(
        workspace,
        workspace.requests.map((r) => ({ requestId: r.id, requestNumber: r.number, credits: r.creditsHeld })),
        this.clock(),
      ),
      contactName: await this.contactName(workspaceId),
    };
  }

  /** The billing contact person (CP-101). Null until billing ships the view. */
  private async contactName(workspaceId: number): Promise<string | null> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ contact_name: string | null }>>`
        SELECT contact_name FROM billing.client_directory WHERE id = ${workspaceId}`;
      const name = rows[0]?.contact_name?.trim();
      return name ? name : null;
    } catch (error) {
      if (DIRECTORY_MISSING.has(postgresCode(error))) return null;
      throw error;
    }
  }
}

/** "mei.ling@kopilane.com" → "mei.ling": the fallback until the contact name exists. */
export function emailName(email: string): string {
  return email.split('@')[0] || email;
}

function postgresCode(error: unknown): string {
  const meta = (error as { meta?: { code?: string } }).meta;
  return meta?.code ?? /Code: `(\w+)`/.exec(String((error as Error).message))?.[1] ?? '';
}
