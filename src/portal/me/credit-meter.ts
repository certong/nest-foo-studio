import type { z } from 'zod';
import type { CreditsBlock } from '../../contract/credits';

export type CreditsView = z.infer<typeof CreditsBlock>;

export interface WorkspaceBalances {
  grantBalance: number;
  topupBalance: number;
  creditsHeld: number;
  monthlyGrant: number;
}

export interface Hold {
  requestId: string;
  requestNumber: number;
  credits: number;
}

/** Malaysia has no daylight saving: UTC+8 all year. */
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;

/** The 1st of next month in Malaysia time, when the monthly cron resets credits (00:05 MYT). */
export function nextResetOn(now: Date): string {
  const myt = new Date(now.getTime() + MYT_OFFSET_MS);
  const year = myt.getUTCFullYear() + (myt.getUTCMonth() === 11 ? 1 : 0);
  const month = (myt.getUTCMonth() + 1) % 12;
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

/**
 * The credit meter from workspace's cached balances: no ledger sum per page
 * load. Holds come out of the monthly bucket first, as charges do, and only
 * what monthly cannot cover is taken from top-up.
 */
export function creditMeter(balances: WorkspaceBalances, holds: Hold[], now: Date): CreditsView {
  const { grantBalance, topupBalance, creditsHeld, monthlyGrant } = balances;
  const heldFromMonthly = Math.min(creditsHeld, grantBalance);
  const heldFromTopup = creditsHeld - heldFromMonthly;
  const monthlyFree = grantBalance - heldFromMonthly;
  const topupFree = Math.max(0, topupBalance - heldFromTopup);

  return {
    free: monthlyFree + topupFree,
    monthly: {
      free: monthlyFree,
      grant: monthlyGrant,
      used: Math.max(0, monthlyGrant - grantBalance),
      resetOn: nextResetOn(now),
    },
    topup: { free: topupFree, neverExpires: true },
    held: creditsHeld,
    heldFor: holds.map((h) => ({ requestId: h.requestId, requestNumber: h.requestNumber, credits: h.credits })),
  };
}
