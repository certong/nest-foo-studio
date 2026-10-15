import { z } from 'zod';

/**
 * DB status → what the client sees. The API sends the result of mapStatus()
 * with every request, so the frontend never maps statuses itself and the
 * wording changes here, in one place.
 *
 * "Agent" is one party for the client: Studio, the AI agents and Chi (admin)
 * all show as Agent.
 */

export const RequestStatus = z
  .enum(['draft', 'paused', 'submitted', 'building', 'checking', 'uat', 'live', 'pending_chi', 'closed'])
  .meta({ id: 'RequestStatus' });
export type RequestStatus = z.infer<typeof RequestStatus>;

/** Postgres enum on request; set only when status = 'closed' (CHECK). */
export const CloseReason = z
  .enum(['client_cancelled', 'no_reply', 'agent_closed'])
  .meta({ id: 'CloseReason' });
export type CloseReason = z.infer<typeof CloseReason>;

export const RequestType = z.enum(['change', 'new_page']).meta({ id: 'RequestType' });
export type RequestType = z.infer<typeof RequestType>;

export const StatusKey = z
  .enum([
    'Draft-You',
    'Building-Agent',
    'Checking-Agent',
    'Ready-to-Check-You',
    'Live',
    'On-Hold',
    'Cancelled-You',
    'Closed-No-Reply',
    'Closed-Agent',
  ])
  .meta({ id: 'StatusKey' });
export type StatusKey = z.infer<typeof StatusKey>;

export const Owner = z.enum(['client', 'agent']).nullable().meta({ id: 'Owner' });
export type Owner = z.infer<typeof Owner>;

export const StepKey = z.enum(['plan', 'build', 'check', 'ready_to_check', 'live']).meta({ id: 'StepKey' });
export type StepKey = z.infer<typeof StepKey>;

export const StepState = z.enum(['done', 'now', 'your_turn', 'problem', 'todo']).meta({ id: 'StepState' });
export type StepState = z.infer<typeof StepState>;

export const Step = z
  .object({ key: StepKey, label: z.string(), state: StepState })
  .meta({ id: 'Step' });
export type Step = z.infer<typeof Step>;

/** The fields every request card, detail and request.updated event carries. */
export const StatusView = z
  .object({
    status: RequestStatus,
    closeReason: CloseReason.nullable(),
    statusKey: StatusKey,
    badge: z.string(),
    owner: Owner,
    steps: z.array(Step),
  })
  .meta({ id: 'StatusView' });
export type StatusView = z.infer<typeof StatusView>;

const STEP_LABELS: Record<StepKey, string> = {
  plan: 'Plan',
  build: 'Build',
  check: 'Check',
  ready_to_check: 'Ready to Check',
  live: 'Live',
};

const STEPS_BY_TYPE: Record<RequestType, readonly StepKey[]> = {
  change: ['plan', 'check', 'ready_to_check', 'live'],
  new_page: ['plan', 'build', 'check', 'ready_to_check', 'live'],
};

interface Row {
  statusKey: StatusKey;
  badge: string;
  owner: Owner;
}

/** A status on the normal path: anything that is not a stop. */
export type ActiveStatus = Exclude<RequestStatus, 'pending_chi' | 'closed'>;

/** The 9 rows of the FS-85 mapping table. Wording changes go here. */
const ACTIVE_ROWS: Record<ActiveStatus, Row & { step: StepKey }> = {
  draft: { statusKey: 'Draft-You', badge: 'Draft (You)', owner: 'client', step: 'plan' },
  paused: { statusKey: 'Draft-You', badge: 'Draft (You)', owner: 'client', step: 'plan' },
  submitted: { statusKey: 'Building-Agent', badge: 'Building (Agent)', owner: 'agent', step: 'build' },
  building: { statusKey: 'Building-Agent', badge: 'Building (Agent)', owner: 'agent', step: 'build' },
  checking: { statusKey: 'Checking-Agent', badge: 'Checking (Agent)', owner: 'agent', step: 'check' },
  uat: { statusKey: 'Ready-to-Check-You', badge: 'Ready to Check (You)', owner: 'client', step: 'ready_to_check' },
  live: { statusKey: 'Live', badge: 'Live', owner: null, step: 'live' },
};

const ON_HOLD_ROW: Row = { statusKey: 'On-Hold', badge: 'On Hold', owner: 'agent' };

const CLOSED_ROWS: Record<CloseReason, Row> = {
  client_cancelled: { statusKey: 'Cancelled-You', badge: 'Cancelled (You)', owner: null },
  no_reply: { statusKey: 'Closed-No-Reply', badge: 'Closed (No Reply)', owner: null },
  agent_closed: { statusKey: 'Closed-Agent', badge: 'Closed (Agent)', owner: null },
};

export interface MapStatusInput {
  status: RequestStatus;
  closeReason: CloseReason | null;
  type: RequestType;
  /**
   * Only for pending_chi and closed: the last status before the request
   * stopped (from request_event). The tracker stops at that step.
   */
  stoppedAt?: ActiveStatus | null;
}

export class InvalidStatusError extends Error {
  override readonly name = 'InvalidStatusError';
}

/** Changes have no Build step, so submitted/building sit on Check. */
function stepFor(status: ActiveStatus, type: RequestType): StepKey {
  const step = ACTIVE_ROWS[status].step;
  return step === 'build' && type === 'change' ? 'check' : step;
}

function buildSteps(type: RequestType, current: StepKey, stateAtCurrent: StepState): Step[] {
  const keys = STEPS_BY_TYPE[type];
  const at = keys.indexOf(current);
  return keys.map((key, i) => ({
    key,
    label: STEP_LABELS[key],
    state: i < at ? 'done' : i === at ? stateAtCurrent : 'todo',
  }));
}

export function mapStatus(input: MapStatusInput): StatusView {
  const { status, closeReason, type } = input;
  const stoppedAt = input.stoppedAt ?? null;

  // Mirrors the DB CHECK: close_reason is set exactly when status = 'closed'.
  if (status === 'closed') {
    if (closeReason === null) throw new InvalidStatusError('closed request has no close_reason');
    if (stoppedAt === null) throw new InvalidStatusError('closed request needs stoppedAt');
    // Greyed-out tracker; the badge says why it closed.
    return { status, closeReason, ...CLOSED_ROWS[closeReason], steps: buildSteps(type, stepFor(stoppedAt, type), 'todo') };
  }
  if (closeReason !== null) {
    throw new InvalidStatusError(`close_reason "${closeReason}" set on status "${status}"`);
  }

  if (status === 'pending_chi') {
    if (stoppedAt === null) throw new InvalidStatusError('pending_chi request needs stoppedAt');
    return { status, closeReason, ...ON_HOLD_ROW, steps: buildSteps(type, stepFor(stoppedAt, type), 'problem') };
  }
  if (stoppedAt !== null) {
    throw new InvalidStatusError(`stoppedAt given for status "${status}"`);
  }

  const { step: _step, ...row } = ACTIVE_ROWS[status];
  const current: StepState = status === 'live' ? 'done' : row.owner === 'client' ? 'your_turn' : 'now';
  return { status, closeReason, ...row, steps: buildSteps(type, stepFor(status, type), current) };
}

/* Top-ups ---------------------------------------------------------------- */

export const TopupStatus = z.enum(['requested', 'approved', 'cancelled']).meta({ id: 'TopupStatus' });
export type TopupStatus = z.infer<typeof TopupStatus>;

/** Only "requested" is fixed by FS-85; the other two are placeholders for FS-95. */
const TOPUP_BADGES: Record<TopupStatus, string> = {
  requested: 'Waiting for payment',
  approved: 'Credits added',
  cancelled: 'Cancelled',
};

export function mapTopupBadge(status: TopupStatus): string {
  return TOPUP_BADGES[status];
}
