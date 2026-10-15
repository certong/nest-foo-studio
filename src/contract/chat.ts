import { z } from 'zod';
import { Credits, Id, IsoDate, IsoDateTime } from './common';
import { PagePlan } from './new-page';
import { RequestCard } from './requests';

/* Chat and drafts (screens 6–9, 14) --------------------------------------- */

export const ChatMessage = z
  .object({
    seq: z.number().int().positive(),
    role: z.enum(['client', 'ba', 'system']).describe('ba = agent-ba'),
    content: z.string(),
    attachmentIds: z.array(Id),
    createdAt: IsoDateTime,
  })
  .meta({ id: 'ChatMessage' });

/** POST /portal/requests: the new draft plus agent-ba's greeting. */
export const CreateRequestResponse = z.object({ request: RequestCard, message: ChatMessage });

export const MessagesQuery = z.object({
  before: z.coerce.number().int().positive().optional().describe('seq; omit for the newest'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const MessagesResponse = z.object({
  items: z.array(ChatMessage).describe('Newest first'),
  nextBefore: z.number().int().positive().nullable(),
});

export const PostMessageBody = z.object({
  text: z.string().trim().min(1).max(2000),
  attachmentIds: z.array(Id).max(5).default([]),
});

export const Change = z
  .object({ id: z.string(), page: z.string(), old: z.string(), new: z.string() })
  .meta({ id: 'Change' });

/** The side panel next to the chat: a change list or a page plan. */
export const ChatPanel = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('changes'),
      changes: z.array(Change),
      count: z.number().int(),
      max: z.number().int(),
      creditsHeld: Credits,
      canReview: z.boolean(),
    }),
    z.object({ kind: z.literal('page_plan'), plan: PagePlan }),
  ])
  .meta({ id: 'ChatPanel' });

/** One JSON reply, no streaming. The first planned change holds 20 credits. */
export const PostMessageResponse = z.object({
  message: ChatMessage,
  panel: ChatPanel.nullable(),
  turnsLeft: z.number().int().nonnegative(),
}).meta({
  // The sample reply (change) from the Backend API List.
  examples: [
    {
      message: { seq: 7, role: 'ba', content: 'Got it. Hours on Home and Visit us both change.', attachmentIds: [], createdAt: '2026-10-15T06:09:00.000Z' },
      panel: {
        kind: 'changes',
        changes: [{ id: 'c1', page: 'Home', old: '8am–6pm daily', new: '7am–7pm, closed Tuesdays' }],
        count: 3,
        max: 10,
        creditsHeld: 20,
        canReview: true,
      },
      turnsLeft: 9,
    },
  ],
});

/** POST …/pause: "Keep draft for 1 Nov"; releases the hold. */
export const PauseResponse = z.object({
  request: RequestCard,
  keptUntil: IsoDate,
  creditsReleased: Credits,
});

export const DropBody = z.object({ confirm: z.literal(true).optional() });

/** Without confirm nothing happens and the reply says what it would cost. */
export const DropResponse = z.object({
  dropped: z.boolean(),
  cost: Credits.describe('15 once the draft has started, else 0'),
  request: RequestCard.nullable().describe('null when not dropped'),
});

/* Attachments (screens 6, 8) ---------------------------------------------- */

export const CreateAttachmentBody = z.object({
  requestId: Id,
  purpose: z.enum(['screenshot', 'sketch']),
  mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  bytes: z.number().int().positive().max(10 * 1024 * 1024),
});

export const CreateAttachmentResponse = z.object({
  attachmentId: Id,
  uploadUrl: z.url().describe('Signed R2 PUT URL'),
  expiresAt: IsoDateTime,
});

export const AttachmentUrlResponse = z.object({
  url: z.url().describe('Signed view link, valid 5 min'),
  expiresAt: IsoDateTime,
});

/* POST /portal/quotes ("Something new", no AI) ---------------------------- */

export const CreateQuoteBody = z.object({
  description: z.string().trim().min(1).max(4000),
  attachmentIds: z.array(Id).max(5).default([]),
});

export const CreateQuoteResponse = z.object({ quoteId: Id, createdAt: IsoDateTime });
