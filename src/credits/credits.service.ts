import { Injectable } from '@nestjs/common';
import type { Prisma, RequestStatus, WorkspaceStatus } from '@prisma/client';
import type { z } from 'zod';
import { StudioException } from '../common/studio-exception';
import { PrismaService } from '../prisma/prisma.service';
import type { CreditAction as CreditActionSchema } from '../contract/credits';
import { nextResetOn } from '../portal/me/credit-meter';
import { readPrices } from './prices';
import { availableCredits, type Balances } from './split';
import { WorkspaceCache } from './workspace-cache';

export type Tx = Prisma.TransactionClient;
export type CreditAction = z.infer<typeof CreditActionSchema>;

/** Which request moves credits, in which workspace, on whose behalf. */
export interface CreditScope {
  workspaceId: number;
  requestId: string;
  /** The auth account id or an agent name: credit_ledger.created_by. */
  actor: string;
}

export interface HoldResult {
  price: number;
  held: number;
}

export interface ChargeResult {
  price: number;
  fromGrant: number;
  fromTopup: number;
  /** The ledger already had this charge; nothing was written. */
  alreadyCharged: boolean;
}

export interface ReleaseResult {
  released: number;
}

/** The ledger idempotency key of a charge. A split charge's top-up row appends ":topup". */
export function usageKey(requestId: string, action: CreditAction): string {
  return `usage:${requestId}:${action}`;
}

interface LockedWorkspace extends Balances {
  id: number;
  status: WorkspaceStatus;
}

interface LockedRequest {
  id: string;
  status: RequestStatus;
  creditsHeld: number;
}

interface WorkspaceRow {
  id: number;
  status: WorkspaceStatus;
  grant_balance: number;
  topup_balance: number;
  credits_held: number;
}

/**
 * Every credit movement goes through here (FS-92), so the ledger, the cached
 * balances on `workspace` and the /portal/me cache never disagree.
 *
 *   await credits.run(workspaceId, async (tx) => {
 *     // the caller's own writes, and any of:
 *     await credits.hold(tx, scope, 'change');
 *   });
 *
 * `run` is one interactive transaction; hold/charge/release lock the
 * workspace row FOR UPDATE inside it and never open their own.
 */
@Injectable()
export class CreditsService {
  /** Replaceable in tests: resetOn in a 402 depends on the date. */
  clock: () => Date = () => new Date();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: WorkspaceCache,
  ) {}

  /** The only way to write credits: one transaction, the cache invalidated afterwards, success or failure. */
  async run<T>(workspaceId: number, fn: (tx: Tx) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(fn);
    } finally {
      this.cache.invalidate(workspaceId);
    }
  }

  async price(tx: Tx, action: CreditAction): Promise<number> {
    return (await readPrices(tx))[action];
  }

  /** Set aside the action's price for this request. Re-holding a request that already holds it changes nothing. */
  async hold(tx: Tx, scope: CreditScope, action: CreditAction): Promise<HoldResult> {
    const { workspace, request } = await this.lock(tx, scope);
    const price = await this.price(tx, action);
    this.ensureAvailable(workspace, request.creditsHeld, price, scope.requestId);

    const delta = price - request.creditsHeld;
    await tx.request.update({ where: { id: request.id }, data: { creditsHeld: price, creditsPrice: price } });
    if (delta !== 0) {
      await tx.workspace.update({ where: { id: workspace.id }, data: { creditsHeld: { increment: delta } } });
    }
    return { price, held: price };
  }

  async charge(_tx: Tx, _scope: CreditScope, _action: CreditAction): Promise<ChargeResult> {
    throw new Error('Task 5');
  }

  async release(_tx: Tx, _scope: CreditScope): Promise<ReleaseResult> {
    throw new Error('Task 5');
  }

  /** 402 when the price is not covered once this request's own hold is set aside. */
  private ensureAvailable(workspace: Balances, ownHold: number, price: number, requestId: string): void {
    const have = availableCredits(workspace, ownHold);
    if (have >= price) return;
    throw new StudioException('NOT_ENOUGH_CREDITS', {
      needed: price,
      have,
      short: price - have,
      resetOn: nextResetOn(this.clock()),
      draftId: requestId,
    });
  }

  /**
   * The preamble every operation shares: the workspace row locked for the
   * rest of the transaction, re-checked for status, and the request proven to
   * belong to it. Which open statuses an operation allows is the caller's rule.
   */
  private async lock(tx: Tx, scope: CreditScope): Promise<{ workspace: LockedWorkspace; request: LockedRequest }> {
    const rows = await tx.$queryRaw<WorkspaceRow[]>`
      SELECT id, status, grant_balance, topup_balance, credits_held
      FROM studio.workspace WHERE id = ${scope.workspaceId} AND deleted_at IS NULL FOR UPDATE`;
    const row = rows[0];
    if (!row) throw new StudioException('NOT_FOUND');
    if (row.status !== 'active') throw new StudioException('WORKSPACE_READ_ONLY');

    const request = await tx.request.findFirst({
      where: { id: scope.requestId, workspaceId: scope.workspaceId },
      select: { id: true, status: true, creditsHeld: true },
    });
    if (!request) throw new StudioException('NOT_FOUND');
    if (request.status === 'closed') throw new StudioException('INVALID_STATE', undefined, 'The request is closed');

    return {
      workspace: { id: row.id, status: row.status, grantBalance: row.grant_balance, topupBalance: row.topup_balance, creditsHeld: row.credits_held },
      request,
    };
  }
}
