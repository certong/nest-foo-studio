/** The cached balances on `workspace`. */
export interface Balances {
  grantBalance: number;
  topupBalance: number;
  creditsHeld: number;
}

/**
 * What a workspace can still spend: both buckets less the holds of other
 * requests. `ownHold` is the calling request's current hold, which does not
 * count against it (re-holding, or charging what was held).
 */
export function availableCredits(b: Balances, ownHold = 0): number {
  return b.grantBalance + b.topupBalance - (b.creditsHeld - ownHold);
}

/**
 * Monthly credits are always spent first; top-up covers the rest. The caller
 * has already checked that price ≤ grant + topup.
 */
export function splitCharge(grantBalance: number, price: number): { fromGrant: number; fromTopup: number } {
  const fromGrant = Math.min(Math.max(grantBalance, 0), price);
  return { fromGrant, fromTopup: price - fromGrant };
}
