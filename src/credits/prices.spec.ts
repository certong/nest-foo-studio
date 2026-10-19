import { StudioException } from '../common/studio-exception';
import { parsePrices } from './prices';

describe('parsePrices (the credit_prices setting)', () => {
  it('accepts the seed row', () => {
    expect(parsePrices({ change: 20, drop: 15, extra_preview: 10 })).toEqual({ change: 20, drop: 15, extra_preview: 10 });
  });

  it.each([
    ['no row', undefined],
    ['null', null],
    ['an action missing', { change: 20, drop: 15 }],
    ['a fractional price', { change: 20, drop: 15, extra_preview: 2.5 }],
    ['a zero price', { change: 20, drop: 15, extra_preview: 0 }],
  ])('rejects %s with 500 INTERNAL, never a default', (_name, value) => {
    expect(() => parsePrices(value)).toThrow(StudioException);
    try {
      parsePrices(value);
    } catch (e) {
      expect((e as StudioException).code).toBe('INTERNAL');
      expect((e as StudioException).message).toContain('credit_prices');
    }
  });
});
