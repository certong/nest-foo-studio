import { z } from 'zod';
import { IsoDate } from './common';

/* Preview review / UAT (screen 12) ---------------------------------------- */

export const UatResponse = z.object({
  previewUrl: z.url(),
  replyBy: IsoDate,
  freeRoundsLeft: z.number().int().nonnegative(),
});

export const UatFeedbackBody = z.object({ notes: z.string().trim().min(1).max(4000) });
