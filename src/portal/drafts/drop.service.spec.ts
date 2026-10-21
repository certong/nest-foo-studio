import { hasStarted } from './drop.service';

const fresh = { creditsHeld: 0, pagePlan: null, layoutOptions: null, baMessagesAfterGreeting: 0 };

describe('hasStarted: AI was already used on the draft', () => {
  it('a draft with only the greeting has not started', () => {
    expect(hasStarted(fresh)).toBe(false);
  });

  it.each([
    ['credits are held', { ...fresh, creditsHeld: 20 }],
    ['a page plan exists', { ...fresh, pagePlan: { pages: [] } }],
    ['layout options were shown', { ...fresh, layoutOptions: [] }],
    ['agent-ba replied after the greeting', { ...fresh, baMessagesAfterGreeting: 1 }],
  ])('has started once %s', (_name, facts) => {
    expect(hasStarted(facts)).toBe(true);
  });
});
