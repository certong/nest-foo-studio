import type { z } from 'zod';
import type { RequestCard as RequestCardSchema } from '../../contract/requests';
import { type ActiveStatus, type CloseReason, mapStatus, type RequestStatus, type RequestType } from '../../contract/status';

export type RequestCard = z.infer<typeof RequestCardSchema>;

/** The columns of `request` a card needs. */
export interface RequestRow {
  id: string;
  number: number;
  type: RequestType;
  title: string;
  status: RequestStatus;
  closeReason: CloseReason | null;
  creditsHeld: number;
  updatedAt: Date;
}

/**
 * The card every request route returns (list, detail, and the reply to any
 * request-changing POST). `stoppedAt` is the last active status before a
 * request went pending_chi or closed, from request_event. `replyBy` is
 * FS-102's 7-day deadline; null until then.
 */
export function requestCard(row: RequestRow, stoppedAt: ActiveStatus | null = null, replyBy: string | null = null): RequestCard {
  return {
    ...mapStatus({ status: row.status, closeReason: row.closeReason, type: row.type, stoppedAt }),
    id: row.id,
    number: row.number,
    type: row.type,
    title: row.title,
    replyBy,
    creditsHeld: row.creditsHeld,
    updatedAt: row.updatedAt.toISOString(),
  };
}
