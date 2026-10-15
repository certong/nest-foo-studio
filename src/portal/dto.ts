import { createZodDto } from 'nestjs-zod';
import * as changes from '../contract/changes';
import * as chat from '../contract/chat';
import * as common from '../contract/common';
import * as credits from '../contract/credits';
import * as newPage from '../contract/new-page';
import * as requests from '../contract/requests';
import * as uat from '../contract/uat';

/**
 * Nest DTO classes over the contract's zod schemas. The class name is the
 * name FE sees under components.schemas, so it matches the schema's name.
 */

export class IdParam extends createZodDto(common.IdParam) {}

/* Home, requests and progress */
export class MeResponse extends createZodDto(requests.MeResponse) {}
export class HomeResponse extends createZodDto(requests.HomeResponse) {}
export class ListRequestsQuery extends createZodDto(requests.ListRequestsQuery) {}
export class ListRequestsResponse extends createZodDto(requests.ListRequestsResponse) {}
export class RequestsSummaryResponse extends createZodDto(requests.RequestsSummaryResponse) {}
export class RequestDetail extends createZodDto(requests.RequestDetail) {}
export class RequestReply extends createZodDto(requests.RequestReply) {}
export class CreateRequestBody extends createZodDto(requests.CreateRequestBody) {}

/* Chat and drafts */
export class CreateRequestResponse extends createZodDto(chat.CreateRequestResponse) {}
export class MessagesQuery extends createZodDto(chat.MessagesQuery) {}
export class MessagesResponse extends createZodDto(chat.MessagesResponse) {}
export class PostMessageBody extends createZodDto(chat.PostMessageBody) {}
export class PostMessageResponse extends createZodDto(chat.PostMessageResponse) {}
export class PauseResponse extends createZodDto(chat.PauseResponse) {}
export class DropBody extends createZodDto(chat.DropBody) {}
export class DropResponse extends createZodDto(chat.DropResponse) {}
export class CreateAttachmentBody extends createZodDto(chat.CreateAttachmentBody) {}
export class CreateAttachmentResponse extends createZodDto(chat.CreateAttachmentResponse) {}
export class AttachmentUrlResponse extends createZodDto(chat.AttachmentUrlResponse) {}
export class CreateQuoteBody extends createZodDto(chat.CreateQuoteBody) {}
export class CreateQuoteResponse extends createZodDto(chat.CreateQuoteResponse) {}

/* Change lane */
export class ChangesResponse extends createZodDto(changes.ChangesResponse) {}
export class ReviewResponse extends createZodDto(changes.ReviewResponse) {}
export class PatchReviewBody extends createZodDto(changes.PatchReviewBody) {}
export class ApproveBody extends createZodDto(changes.ApproveBody) {}
export class FixBody extends createZodDto(changes.FixBody) {}

/* New page lane */
export class LayoutsResponse extends createZodDto(newPage.LayoutsResponse) {}
export class LayoutOptionsBody extends createZodDto(newPage.LayoutOptionsBody) {}
export class LayoutOptionsResponse extends createZodDto(newPage.LayoutOptionsResponse) {}
export class LayoutOptionParams extends createZodDto(newPage.LayoutOptionParams) {}
export class PlanResponse extends createZodDto(newPage.PlanResponse) {}
export class CreatePreviewBody extends createZodDto(newPage.CreatePreviewBody) {}
export class CreatePreviewResponse extends createZodDto(newPage.CreatePreviewResponse) {}
export class PreviewParams extends createZodDto(newPage.PreviewParams) {}
export class PreviewResponse extends createZodDto(newPage.PreviewResponse) {}
export class SignOffResponse extends createZodDto(newPage.SignOffResponse) {}
export class SignOffBody extends createZodDto(newPage.SignOffBody) {}

/* Preview review / UAT */
export class UatResponse extends createZodDto(uat.UatResponse) {}
export class UatFeedbackBody extends createZodDto(uat.UatFeedbackBody) {}

/* Credits and top-up */
export class CreditsResponse extends createZodDto(credits.CreditsResponse) {}
export class LedgerQuery extends createZodDto(credits.LedgerQuery) {}
export class LedgerResponse extends createZodDto(credits.LedgerResponse) {}
export class CreateTopupBody extends createZodDto(credits.CreateTopupBody) {}
export class TopupReply extends createZodDto(credits.TopupReply) {}
export class TopupList extends createZodDto(credits.TopupList) {}
