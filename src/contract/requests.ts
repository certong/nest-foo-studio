import { z } from 'zod';
import { Credits, Id, IsoDate, IsoDateTime, IsoMonth, page, PageQuery } from './common';
import { CreditsBlock } from './credits';
import { RequestType, StatusView } from './status';

/* GET /portal/me (screen 3, nav) ----------------------------------------- */

export const MeResponse = z.object({
  account: z.object({ name: z.string(), email: z.email() }),
  workspace: z.object({
    name: z.string(),
    status: z.enum(['active', 'read_only', 'deactivated']),
    site: z.string().describe('Site domain, e.g. kopilane.com'),
  }),
  credits: CreditsBlock,
}).meta({
  // The sample reply from the Backend API List: Kopi Lane, seed data.
  examples: [
    {
      account: { name: 'Mei Ling', email: 'hello@kopilane.com' },
      workspace: { name: 'Kopi Lane', status: 'active', site: 'kopilane.com' },
      credits: {
        free: 125,
        monthly: { free: 125, grant: 200, used: 55, resetOn: '2026-11-01' },
        topup: { free: 0, neverExpires: true },
        held: 20,
        heldFor: [{ requestId: 43, credits: 20 }],
      },
    },
  ],
});

/* Request cards ----------------------------------------------------------- */

export const RequestCard = StatusView.extend({
  id: Id,
  type: RequestType,
  title: z.string(),
  replyBy: IsoDate.nullable().describe('Set while it is the client’s turn'),
  creditsHeld: Credits,
  updatedAt: IsoDateTime,
}).meta({ id: 'RequestCard' });

/** What the client may do right now; the UI shows only these buttons. */
export const RequestAction = z
  .enum([
    'open_chat',
    'pause',
    'resume',
    'drop',
    'review',
    'approve',
    'fix',
    'pick_layout',
    'make_preview',
    'sign_off',
    'uat_approve',
    'uat_feedback',
  ])
  .meta({ id: 'RequestAction' });

/** Request-changing POSTs reply with the card as it is now. */
export const RequestReply = z.object({ request: RequestCard });

/* GET /portal/home (screen 3) --------------------------------------------- */

export const HomeResponse = z.object({
  focus: z
    .object({
      action: RequestAction,
      requestId: Id.nullable(),
      title: z.string(),
    })
    .nullable()
    .describe('The one thing to do next; null when nothing is waiting'),
  waitingForYou: z.array(RequestCard),
  creditsByMonth: z.array(z.object({ month: IsoMonth, used: Credits })).describe('Last 4 months'),
  monthlyGrant: Credits.describe('The 200 line on the chart'),
});

/* GET /portal/requests?tab= (screen 4) ------------------------------------ */

export const RequestTab = z.enum(['active', 'live', 'all']).meta({ id: 'RequestTab' });

export const ListRequestsQuery = PageQuery.extend({ tab: RequestTab.default('active') });

export const ListRequestsResponse = page(RequestCard).extend({
  counts: z.object({ active: z.number().int(), live: z.number().int(), all: z.number().int() }),
});

/* GET /portal/requests/summary (screen 4b) -------------------------------- */

export const RequestsSummaryResponse = z.object({
  changesDone: z.number().int().nonnegative(),
  pagesLive: z.number().int().nonnegative(),
});

/* GET /portal/requests/:id (screen 13) ------------------------------------ */

export const RequestDetail = RequestCard.extend({
  timeline: z.array(z.object({ at: IsoDateTime, text: z.string() })).describe('Dated, from request_event'),
  signedOff: z
    .object({ at: IsoDateTime, what: z.string(), termsVersion: z.string().nullable() })
    .nullable(),
  nextStep: z.string().nullable().describe('Shown on every closed or held request'),
  actions: z.array(RequestAction),
});

/* POST /portal/requests (screen 6) ---------------------------------------- */

export const CreateRequestBody = z.object({ type: RequestType });
