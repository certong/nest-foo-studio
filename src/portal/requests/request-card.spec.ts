import { RequestCard } from '../../contract/requests';
import { requestCard } from './request-card';

const row = {
  id: '0199e5a8-7c00-7a43-9d1e-5b2f0c3a4e43',
  number: 43,
  type: 'change' as const,
  title: 'Opening hours and WhatsApp',
  status: 'draft' as const,
  closeReason: null,
  creditsHeld: 20,
  updatedAt: new Date('2026-10-14T00:55:00.000Z'),
};

describe('requestCard', () => {
  it('a draft: Draft (You), your turn on Plan, no reply-by yet', () => {
    const card = requestCard(row);
    expect(card).toMatchObject({
      id: row.id,
      number: 43,
      type: 'change',
      title: 'Opening hours and WhatsApp',
      status: 'draft',
      closeReason: null,
      statusKey: 'Draft-You',
      owner: 'client',
      replyBy: null,
      creditsHeld: 20,
      updatedAt: '2026-10-14T00:55:00.000Z',
    });
    expect(card.steps[0]).toEqual({ key: 'plan', label: 'Plan', state: 'your_turn' });
    expect(() => RequestCard.parse(card)).not.toThrow();
  });

  it('closed by the client while drafting: Cancelled (You), every step still to do', () => {
    const card = requestCard({ ...row, status: 'closed', closeReason: 'client_cancelled', creditsHeld: 0 }, 'draft');
    expect(card.badge).toBe('Cancelled (You)');
    expect(card.owner).toBeNull();
    expect(card.steps.every((s) => s.state === 'todo')).toBe(true);
    expect(() => RequestCard.parse(card)).not.toThrow();
  });
});
