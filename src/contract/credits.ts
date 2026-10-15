import { z } from 'zod';
import { Credits, Id, IsoDate, IsoDateTime, IsoMonth } from './common';
import { mapTopupBadge, TopupStatus } from './status';

/**
 * Credits sit in two buckets. Monthly credits are spent first, then top-up.
 * Holds don't own a bucket: `held` is one workspace total, and the bucket is
 * picked when the hold is charged.
 */
export const CreditsBlock = z
  .object({
    free: Credits.describe('monthly.free + topup.free'),
    monthly: z.object({
      free: Credits,
      grant: Credits.describe('Granted on the 1st (200)'),
      used: Credits,
      resetOn: IsoDate,
    }),
    topup: z.object({
      free: Credits,
      neverExpires: z.literal(true),
    }),
    held: Credits,
    heldFor: z.array(z.object({ requestId: Id, credits: Credits })),
  })
  .meta({ id: 'CreditsBlock' });

export const CreditAction = z.enum(['change', 'drop', 'extra_preview']).meta({ id: 'CreditAction' });

/** GET /portal/credits (screen 5) */
export const CreditsResponse = CreditsBlock.extend({
  usageByType: z.array(z.object({ action: CreditAction, credits: Credits })),
  usageByMonth: z.array(z.object({ month: IsoMonth, used: Credits })).describe('Last 4 months'),
  prices: z.array(z.object({ action: CreditAction, credits: Credits })),
  topupPacks: z.array(z.object({ credits: Credits, priceRm: z.number().positive() })),
});

export const LedgerQuery = z.object({ month: IsoMonth });

export const LedgerKind = z
  .enum(['grant', 'charge', 'hold', 'release', 'topup', 'adjust', 'expire'])
  .meta({ id: 'LedgerKind' });

/** GET /portal/credits/ledger?month=2026-10: "+200, −20, −15, 20 set aside" */
export const LedgerResponse = z.object({
  month: IsoMonth,
  entries: z.array(
    z.object({
      id: Id,
      at: IsoDateTime,
      kind: LedgerKind,
      credits: z.number().int().describe('Signed: + adds, − spends; a hold shows the amount set aside'),
      bucket: z.enum(['grant', 'topup']).nullable().describe('null for holds and releases'),
      requestId: Id.nullable(),
      label: z.string(),
    }),
  ),
});

/* Top-ups (screens 5, 14) ------------------------------------------------- */

export const CreateTopupBody = z.object({ pack: z.literal(100) });

export const Topup = z
  .object({
    id: Id,
    status: TopupStatus,
    badge: z.string().describe(`From mapTopupBadge(); requested → "${mapTopupBadge('requested')}"`),
    credits: Credits,
    priceRm: z.number().positive(),
    createdAt: IsoDateTime,
    payment: z.object({
      reference: z.string().describe('Put this in the transfer note'),
      duitNow: z.object({ id: z.string(), name: z.string() }),
      bank: z.object({ name: z.string(), accountName: z.string(), accountNo: z.string() }),
    }),
  })
  .meta({ id: 'Topup' });

export const TopupList = z.object({ items: z.array(Topup) });

/** Top-up POSTs reply with the top-up as it is now. */
export const TopupReply = z.object({ topup: Topup });
