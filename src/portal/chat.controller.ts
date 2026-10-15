import { Body, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { ApiErrors } from '../common/api-errors.decorator';
import { CurrentWorkspace, type WorkspaceScope } from '../common/current-workspace.decorator';
import { RequireIdempotencyKey } from '../common/idempotency-key.decorator';
import { notImplemented } from '../common/studio-exception';
import {
  AttachmentUrlResponse,
  CreateAttachmentBody,
  CreateAttachmentResponse,
  CreateQuoteBody,
  CreateQuoteResponse,
  DropBody,
  DropResponse,
  IdParam,
  MessagesQuery,
  MessagesResponse,
  PauseResponse,
  PostMessageBody,
  PostMessageResponse,
  RequestReply,
} from './dto';
import { PortalController } from './portal-controller.decorator';

@PortalController('', 'Chat and drafts')
export class ChatController {
  @Get('requests/:id/messages')
  @ApiOperation({ summary: 'One request’s chat, newest first, paged by seq', description: 'Screens 6–9' })
  @ZodResponse({ type: MessagesResponse })
  @ApiErrors('NOT_FOUND')
  messages(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: IdParam, @Query() _query: MessagesQuery) {
    return notImplemented('FS-35');
  }

  @Post('requests/:id/messages')
  @ApiOperation({
    summary: 'Send a message; one JSON reply from agent-ba with the side panel and turnsLeft',
    description: 'Screens 6–9. The first planned change holds 20 credits.',
  })
  @ZodResponse({ status: 201, type: PostMessageResponse })
  @ApiErrors('NOT_FOUND', 'INVALID_STATE', 'LIMIT_REACHED', 'NOT_ENOUGH_CREDITS', 'AI_CAP_REACHED', 'WORKSPACE_READ_ONLY', 'AGENT_OFFLINE')
  send(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: IdParam, @Body() _body: PostMessageBody) {
    return notImplemented('FS-35');
  }

  @Post('requests/:id/pause')
  @ApiOperation({ summary: '"Keep draft for 1 Nov"; releases the hold', description: 'Screen 14' })
  @ZodResponse({ status: 200, type: PauseResponse })
  @ApiErrors('NOT_FOUND', 'INVALID_STATE')
  pause(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: IdParam) {
    return notImplemented('FS-35');
  }

  @Post('requests/:id/resume')
  @ApiOperation({ summary: 'Back to chat; re-holds credits', description: 'Screen 4' })
  @ZodResponse({ status: 200, type: RequestReply })
  @ApiErrors('NOT_FOUND', 'INVALID_STATE', 'NOT_ENOUGH_CREDITS', 'WORKSPACE_READ_ONLY')
  resume(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: IdParam) {
    return notImplemented('FS-35');
  }

  @Post('requests/:id/drop')
  @RequireIdempotencyKey()
  @ApiOperation({
    summary: 'Drop a draft. A started draft costs 15; without confirm the reply only shows the cost',
    description: 'Screens 4, 9',
  })
  @ZodResponse({ status: 200, type: DropResponse })
  @ApiErrors('NOT_FOUND', 'INVALID_STATE', 'WORKSPACE_READ_ONLY')
  drop(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: IdParam, @Body() _body: DropBody) {
    return notImplemented('FS-92');
  }

  @Post('attachments')
  @ApiOperation({ summary: 'Signed R2 upload URL and attachmentId', description: 'Screens 6, 8' })
  @ZodResponse({ status: 201, type: CreateAttachmentResponse })
  @ApiErrors('NOT_FOUND', 'INVALID_STATE', 'LIMIT_REACHED', 'WORKSPACE_READ_ONLY')
  createAttachment(@CurrentWorkspace() _ws: WorkspaceScope, @Body() _body: CreateAttachmentBody) {
    return notImplemented('FS-96');
  }

  @Get('attachments/:id/url')
  @ApiOperation({ summary: 'Signed view link, valid 5 min', description: 'Screens 6–8' })
  @ZodResponse({ type: AttachmentUrlResponse })
  @ApiErrors('NOT_FOUND')
  attachmentUrl(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: IdParam) {
    return notImplemented('FS-96');
  }

  @Post('quotes')
  @ApiOperation({ summary: '"Something new": straight to Chi’s queue, no AI', description: 'Screen 6' })
  @ZodResponse({ status: 201, type: CreateQuoteResponse })
  @ApiErrors('WORKSPACE_READ_ONLY')
  createQuote(@CurrentWorkspace() _ws: WorkspaceScope, @Body() _body: CreateQuoteBody) {
    return notImplemented('FS-43');
  }
}
