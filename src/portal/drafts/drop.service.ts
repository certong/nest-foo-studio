import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import type { WorkspaceScope } from '../../common/current-workspace.decorator';
import { StudioException } from '../../common/studio-exception';
import type { DropBody, DropResponse } from '../../contract/chat';
import type { ActiveStatus } from '../../contract/status';
import { CreditsService } from '../../credits/credits.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requestCard } from '../requests/request-card';

type Drop = z.infer<typeof DropResponse>;

/** What decides whether a draft has cost AI already. */
export interface DraftFacts {
  creditsHeld: number;
  pagePlan: unknown;
  layoutOptions: unknown;
  /** agent-ba messages with seq > 1: anything after the greeting. */
  baMessagesAfterGreeting: number;
}

/** A started draft costs 15 to drop, because AI was already used on it. */
export function hasStarted(facts: DraftFacts): boolean {
  return (
    facts.creditsHeld > 0 || facts.pagePlan !== null || facts.layoutOptions !== null || facts.baMessagesAfterGreeting > 0
  );
}

const DROPPABLE: ReadonlySet<string> = new Set<ActiveStatus>(['draft', 'paused']);

/**
 * POST /portal/requests/:id/drop (screens 4, 9). Without `confirm` it only
 * says what dropping would cost; with it, the draft closes as
 * client_cancelled and a started draft is charged the drop price.
 */
@Injectable()
export class DropService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
  ) {}

  async drop(ws: WorkspaceScope, requestId: string, body: z.infer<typeof DropBody>): Promise<Drop> {
    const row = await this.prisma.request.findFirst({
      where: { id: requestId, workspaceId: ws.clientId },
      include: {
        workspace: { select: { status: true } },
        _count: { select: { messages: { where: { role: 'ba', seq: { gt: 1 } } } } },
      },
    });
    if (!row) throw new StudioException('NOT_FOUND');
    if (row.workspace.status !== 'active') throw new StudioException('WORKSPACE_READ_ONLY');
    if (!DROPPABLE.has(row.status)) {
      throw new StudioException('INVALID_STATE', undefined, 'Only a draft can be dropped');
    }
    const previous = row.status as ActiveStatus;

    const started = hasStarted({
      creditsHeld: row.creditsHeld,
      pagePlan: row.pagePlan,
      layoutOptions: row.layoutOptions,
      baMessagesAfterGreeting: row._count.messages,
    });
    const cost = started ? await this.credits.price(this.prisma, 'drop') : 0;
    if (body.confirm !== true) return { dropped: false, cost, request: null };

    const scope = { workspaceId: ws.clientId, requestId, actor: ws.accountId };
    const request = await this.credits.run(ws.clientId, async (tx) => {
      if (cost > 0) await this.credits.charge(tx, scope, 'drop');
      else await this.credits.release(tx, scope);
      const closed = await tx.request.update({
        where: { id: requestId },
        data: { status: 'closed', closeReason: 'client_cancelled' },
      });
      await tx.requestEvent.create({
        data: { requestId, workspaceId: ws.clientId, fromStatus: previous, toStatus: 'closed', actorAccountId: ws.accountId },
      });
      return requestCard(closed, previous);
    });
    return { dropped: true, cost, request };
  }
}
