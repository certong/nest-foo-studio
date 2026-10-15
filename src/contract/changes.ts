import { z } from 'zod';
import { Credits } from './common';
import { Change } from './chat';

/* Change lane (screens 7, 10) --------------------------------------------- */

/** GET …/changes: old → new, "3 of 10", credits held. */
export const ChangesResponse = z.object({
  changes: z.array(Change),
  count: z.number().int().nonnegative(),
  max: z.number().int().positive(),
  creditsHeld: Credits,
});

export const Language = z.enum(['en', 'ms', 'zh']).meta({ id: 'Language', description: 'EN, BM, CN' });

export const ReviewChange = z
  .object({
    id: z.string(),
    page: z.string(),
    pageUrl: z.url(),
    englishOnly: z.boolean(),
    languages: z.array(z.object({ language: Language, now: z.string(), after: z.string() })),
  })
  .meta({ id: 'ReviewChange' });

/** GET and PATCH …/review: each change, Now vs After, per language. */
export const ReviewResponse = z.object({ changes: z.array(ReviewChange), creditsOnApprove: Credits });

/** "Update Malay too / English only" */
export const PatchReviewBody = z.object({
  changes: z.array(z.object({ id: z.string(), englishOnly: z.boolean() })).min(1),
});

export const ApproveBody = z.object({ checkedText: z.literal(true) });

export const FixBody = z.object({ note: z.string().trim().min(1).max(2000) });
