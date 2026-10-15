import { z } from 'zod';
import { Id, IsoDate, IsoDateTime } from './common';

/* New page lane (screens 8, 9, 11) ---------------------------------------- */

/** One section of a page, as block JSON for the browser renderer. */
export const Block = z
  .object({
    id: z.string(),
    kind: z.string().describe('hero, text, gallery, menu, contact, map, …'),
    props: z.record(z.string(), z.unknown()),
  })
  .meta({ id: 'Block' });

export const Layout = z
  .object({ id: Id.describe('thumbnailId'), name: z.string(), blocks: z.array(Block) })
  .meta({ id: 'Layout' });

/** GET /portal/layouts: 5–6 thumbnails. */
export const LayoutsResponse = z.object({ items: z.array(Layout) });

/** Start from a sketch upload or from a layout thumbnail, not both. */
export const LayoutOptionsBody = z
  .object({
    attachmentId: Id.optional().describe('An uploaded sketch'),
    thumbnailId: Id.optional().describe('A layout from GET /portal/layouts'),
  })
  .refine((body) => (body.attachmentId === undefined) !== (body.thumbnailId === undefined), {
    message: 'Send exactly one of attachmentId or thumbnailId',
  });

export const LayoutOptionsResponse = z.object({
  feedback: z.array(z.string()).max(3),
  options: z
    .array(z.object({ id: z.string(), name: z.string(), blocks: z.array(Block) }))
    .min(2)
    .max(3),
});

export const LayoutOptionParams = z.object({
  id: z.coerce.number().int().positive(),
  optionId: z.string().min(1),
});

export const PagePlan = z
  .object({
    blocks: z.array(Block),
    sectionsLeft: z.number().int().nonnegative(),
    previewsUsed: z.number().int().nonnegative(),
    freePreviews: z.number().int().positive().describe('5'),
  })
  .meta({ id: 'PagePlan' });

export const PlanResponse = z.object({ plan: PagePlan });

export const CreatePreviewBody = z.object({ confirm: z.literal(true).optional() });

/** From the 6th preview on, nothing happens without confirm and the reply shows the cost (10). */
export const CreatePreviewResponse = z.object({
  created: z.boolean(),
  previewNo: z.number().int().positive().nullable(),
  cost: z.number().int().nonnegative(),
});

export const PreviewParams = z.object({
  id: z.coerce.number().int().positive(),
  n: z.coerce.number().int().positive(),
});

export const PreviewResponse = z.object({
  previewNo: z.number().int().positive(),
  blocks: z.array(Block),
  createdAt: IsoDateTime,
});

/* Sign-off (screen 11) ---------------------------------------------------- */

export const SignOffResponse = z.object({
  summary: z.array(z.string()),
  priceRm: z.number().positive().describe('100'),
  workingDays: z.number().int().positive().describe('3'),
  readyBy: IsoDate,
  terms: z.object({ version: z.string(), text: z.string() }),
  previewNo: z.number().int().positive(),
});

export const SignOffBody = z.object({
  acceptTerms: z.literal(true),
  termsVersion: z.string().min(1),
  previewNo: z.number().int().positive(),
});
