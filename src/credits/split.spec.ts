import { availableCredits, splitCharge } from './split';

describe('availableCredits', () => {
  it('Kopi Lane State B: 145 + 95 − 20 held = 220', () => {
    expect(availableCredits({ grantBalance: 145, topupBalance: 95, creditsHeld: 20 })).toBe(220);
  });

  it("sets a request's own hold aside, so re-holding it is not double-counted", () => {
    expect(availableCredits({ grantBalance: 145, topupBalance: 95, creditsHeld: 20 }, 20)).toBe(240);
  });
});

describe('splitCharge (monthly first)', () => {
  it('15 monthly left, charge 20 → 15 grant + 5 top-up', () => {
    expect(splitCharge(15, 20)).toEqual({ fromGrant: 15, fromTopup: 5 });
  });

  it('all from monthly when it covers the price', () => {
    expect(splitCharge(145, 20)).toEqual({ fromGrant: 20, fromTopup: 0 });
  });

  it('all from top-up when monthly is 0', () => {
    expect(splitCharge(0, 20)).toEqual({ fromGrant: 0, fromTopup: 20 });
  });
});
