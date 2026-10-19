import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { StudioException } from '../common/studio-exception';
import { CreditAction } from '../contract/credits';

/** The `setting` row that prices every credit action: { change: 20, drop: 15, extra_preview: 10 }. */
export const CREDIT_PRICES_KEY = 'credit_prices';

/** Exhaustive: every CreditAction has a positive whole price. */
export const CreditPrices = z.record(CreditAction, z.number().int().positive());
export type CreditPrices = z.infer<typeof CreditPrices>;

/** A missing or malformed row is a server error, never a default price. */
export function parsePrices(value: unknown): CreditPrices {
  const parsed = CreditPrices.safeParse(value);
  if (!parsed.success) {
    throw new StudioException('INTERNAL', undefined, `setting ${CREDIT_PRICES_KEY} is missing or malformed`);
  }
  return parsed.data;
}

export async function readPrices(tx: Prisma.TransactionClient): Promise<CreditPrices> {
  const row = await tx.setting.findUnique({ where: { key: CREDIT_PRICES_KEY }, select: { value: true } });
  return parsePrices(row?.value);
}
