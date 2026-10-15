import { InvalidStatusError, mapStatus, mapTopupBadge, StatusView, type MapStatusInput } from './status';

function states(view: StatusView): string {
  return view.steps.map((s) => `${s.key}:${s.state}`).join(' ');
}

describe('mapStatus — the 9 rows of the FS-85 table', () => {
  const rows: Array<[string, MapStatusInput, Omit<StatusView, 'steps' | 'status' | 'closeReason'>]> = [
    ['draft', { status: 'draft', closeReason: null, type: 'new_page' }, { statusKey: 'Draft-You', badge: 'Draft (You)', owner: 'client' }],
    ['paused', { status: 'paused', closeReason: null, type: 'new_page' }, { statusKey: 'Draft-You', badge: 'Draft (You)', owner: 'client' }],
    ['submitted', { status: 'submitted', closeReason: null, type: 'new_page' }, { statusKey: 'Building-Agent', badge: 'Building (Agent)', owner: 'agent' }],
    ['building', { status: 'building', closeReason: null, type: 'new_page' }, { statusKey: 'Building-Agent', badge: 'Building (Agent)', owner: 'agent' }],
    ['checking', { status: 'checking', closeReason: null, type: 'new_page' }, { statusKey: 'Checking-Agent', badge: 'Checking (Agent)', owner: 'agent' }],
    ['uat', { status: 'uat', closeReason: null, type: 'new_page' }, { statusKey: 'Ready-to-Check-You', badge: 'Ready to Check (You)', owner: 'client' }],
    ['live', { status: 'live', closeReason: null, type: 'new_page' }, { statusKey: 'Live', badge: 'Live', owner: null }],
    ['pending_chi', { status: 'pending_chi', closeReason: null, type: 'new_page', stoppedAt: 'checking' }, { statusKey: 'On-Hold', badge: 'On Hold', owner: 'agent' }],
    ['closed + client_cancelled', { status: 'closed', closeReason: 'client_cancelled', type: 'new_page', stoppedAt: 'draft' }, { statusKey: 'Cancelled-You', badge: 'Cancelled (You)', owner: null }],
    ['closed + no_reply', { status: 'closed', closeReason: 'no_reply', type: 'new_page', stoppedAt: 'uat' }, { statusKey: 'Closed-No-Reply', badge: 'Closed (No Reply)', owner: null }],
    ['closed + agent_closed', { status: 'closed', closeReason: 'agent_closed', type: 'new_page', stoppedAt: 'building' }, { statusKey: 'Closed-Agent', badge: 'Closed (Agent)', owner: null }],
  ];

  it.each(rows)('%s', (_name, input, expected) => {
    const view = mapStatus(input);
    expect(view).toMatchObject({ status: input.status, closeReason: input.closeReason, ...expected });
    expect(() => StatusView.parse(view)).not.toThrow();
  });
});

describe('mapStatus — tracker steps', () => {
  it('a new page has Plan → Build → Check → Ready to Check → Live', () => {
    const view = mapStatus({ status: 'draft', closeReason: null, type: 'new_page' });
    expect(view.steps.map((s) => s.label)).toEqual(['Plan', 'Build', 'Check', 'Ready to Check', 'Live']);
  });

  it('a change has Plan → Check → Ready to Check → Live', () => {
    const view = mapStatus({ status: 'draft', closeReason: null, type: 'change' });
    expect(view.steps.map((s) => s.label)).toEqual(['Plan', 'Check', 'Ready to Check', 'Live']);
  });

  it('draft is the client’s turn on Plan', () => {
    expect(states(mapStatus({ status: 'draft', closeReason: null, type: 'change' }))).toBe(
      'plan:your_turn check:todo ready_to_check:todo live:todo',
    );
  });

  it('building a new page is the agent working on Build', () => {
    expect(states(mapStatus({ status: 'building', closeReason: null, type: 'new_page' }))).toBe(
      'plan:done build:now check:todo ready_to_check:todo live:todo',
    );
  });

  it('a change skips Build: submitted shows the Building badge on the Check step', () => {
    const view = mapStatus({ status: 'submitted', closeReason: null, type: 'change' });
    expect(view.badge).toBe('Building (Agent)');
    expect(states(view)).toBe('plan:done check:now ready_to_check:todo live:todo');
  });

  it('uat is the client’s turn on Ready to Check', () => {
    expect(states(mapStatus({ status: 'uat', closeReason: null, type: 'change' }))).toBe(
      'plan:done check:done ready_to_check:your_turn live:todo',
    );
  });

  it('live has every step done', () => {
    expect(states(mapStatus({ status: 'live', closeReason: null, type: 'new_page' }))).toBe(
      'plan:done build:done check:done ready_to_check:done live:done',
    );
  });

  it('On Hold marks the step it stopped at as a problem', () => {
    expect(states(mapStatus({ status: 'pending_chi', closeReason: null, type: 'change', stoppedAt: 'checking' }))).toBe(
      'plan:done check:problem ready_to_check:todo live:todo',
    );
  });

  it('closed greys out the tracker from the step it stopped at', () => {
    expect(states(mapStatus({ status: 'closed', closeReason: 'no_reply', type: 'change', stoppedAt: 'uat' }))).toBe(
      'plan:done check:done ready_to_check:todo live:todo',
    );
  });
});

describe('mapStatus — rejects what the DB CHECK forbids', () => {
  it('closed without a close_reason', () => {
    expect(() => mapStatus({ status: 'closed', closeReason: null, type: 'change', stoppedAt: 'uat' })).toThrow(InvalidStatusError);
  });

  it('a close_reason on a status that is not closed', () => {
    expect(() => mapStatus({ status: 'live', closeReason: 'no_reply', type: 'change' })).toThrow(InvalidStatusError);
  });

  it('a stopped status without stoppedAt', () => {
    expect(() => mapStatus({ status: 'pending_chi', closeReason: null, type: 'change' })).toThrow(InvalidStatusError);
    expect(() => mapStatus({ status: 'closed', closeReason: 'agent_closed', type: 'change' })).toThrow(InvalidStatusError);
  });

  it('stoppedAt on a status that has not stopped', () => {
    expect(() => mapStatus({ status: 'draft', closeReason: null, type: 'change', stoppedAt: 'draft' })).toThrow(InvalidStatusError);
  });
});

describe('mapTopupBadge', () => {
  it('a requested top-up is waiting for payment', () => {
    expect(mapTopupBadge('requested')).toBe('Waiting for payment');
  });
});
