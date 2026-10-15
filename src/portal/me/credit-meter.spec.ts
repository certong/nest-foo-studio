import { CreditsBlock } from '../../contract/credits';
import { creditMeter, nextResetOn } from './credit-meter';

const OCT_16 = new Date('2026-10-16T03:00:00Z');
const HOLD_43 = { requestId: '0199e5a8-7c00-7a43-9d1e-5b2f0c3a4e43', requestNumber: 43, credits: 20 };

describe('creditMeter', () => {
  it('Kopi Lane State B: 220 free = 125 monthly + 95 top-up, 55 used, 20 held', () => {
    const meter = creditMeter({ grantBalance: 145, topupBalance: 95, creditsHeld: 20, monthlyGrant: 200 }, [HOLD_43], OCT_16);
    expect(meter).toEqual({
      free: 220,
      monthly: { free: 125, grant: 200, used: 55, resetOn: '2026-11-01' },
      topup: { free: 95, neverExpires: true },
      held: 20,
      heldFor: [HOLD_43],
    });
    expect(() => CreditsBlock.parse(meter)).not.toThrow();
  });

  it('takes a hold from monthly first, and only the rest from top-up', () => {
    const meter = creditMeter({ grantBalance: 15, topupBalance: 95, creditsHeld: 20, monthlyGrant: 200 }, [HOLD_43], OCT_16);
    expect(meter.monthly.free).toBe(0);
    expect(meter.topup.free).toBe(90);
    expect(meter.free).toBe(90);
  });

  it('a fresh month with nothing used or held', () => {
    const meter = creditMeter({ grantBalance: 200, topupBalance: 0, creditsHeld: 0, monthlyGrant: 200 }, [], OCT_16);
    expect(meter).toMatchObject({ free: 200, monthly: { free: 200, used: 0 }, topup: { free: 0 }, held: 0, heldFor: [] });
  });

  it('never reports negative usage (e.g. after a refund above the grant)', () => {
    expect(creditMeter({ grantBalance: 210, topupBalance: 0, creditsHeld: 0, monthlyGrant: 200 }, [], OCT_16).monthly.used).toBe(0);
  });
});

describe('nextResetOn (Malaysia time, UTC+8)', () => {
  it.each([
    ['2026-10-16T03:00:00Z', '2026-11-01'],
    // 31 Oct 15:59 UTC is still October in Kuala Lumpur…
    ['2026-10-31T15:59:59Z', '2026-11-01'],
    // …and 16:00 UTC is already 1 Nov there.
    ['2026-10-31T16:00:00Z', '2026-12-01'],
    ['2026-12-15T00:00:00Z', '2027-01-01'],
    ['2026-12-31T16:00:00Z', '2027-02-01'],
  ])('at %s → %s', (now, expected) => {
    expect(nextResetOn(new Date(now))).toBe(expected);
  });
});
