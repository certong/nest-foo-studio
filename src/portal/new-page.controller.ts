import { Body, Get, Param, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { ApiErrors } from '../common/api-errors.decorator';
import { CurrentWorkspace, type WorkspaceScope } from '../common/current-workspace.decorator';
import { RequireIdempotencyKey } from '../common/idempotency-key.decorator';
import { notImplemented } from '../common/studio-exception';
import {
  CreatePreviewBody,
  CreatePreviewResponse,
  IdParam,
  LayoutOptionParams,
  LayoutOptionsBody,
  LayoutOptionsResponse,
  LayoutsResponse,
  PlanResponse,
  PreviewParams,
  PreviewResponse,
  RequestReply,
  SignOffBody,
  SignOffResponse,
} from './dto';
import { PortalController } from './portal-controller.decorator';

@PortalController('', 'New page lane')
export class NewPageController {
  @Get('layouts')
  @ApiOperation({ summary: '5–6 layout thumbnails as block JSON', description: 'Screen 8' })
  @ZodResponse({ type: LayoutsResponse })
  @ApiErrors()
  layouts(@CurrentWorkspace() _ws: WorkspaceScope) {
    return notImplemented('FS-99');
  }

  @Post('requests/:id/layout-options')
  @ApiOperation({
    summary: 'From a sketch or a thumbnail: up to 3 feedback points and 2–3 options. Free',
    description: 'Screen 8',
  })
  @ZodResponse({ status: 200, type: LayoutOptionsResponse })
  @ApiErrors('NOT_FOUND', 'INVALID_STATE', 'SKETCH_UNREADABLE', 'AI_CAP_REACHED', 'AGENT_OFFLINE')
  layoutOptions(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: IdParam, @Body() _body: LayoutOptionsBody) {
    return notImplemented('FS-99');
  }

  @Post('requests/:id/layout-options/:optionId/pick')
  @ApiOperation({ summary: 'The option becomes the page plan', description: 'Screen 8 → 9' })
  @ZodResponse({ status: 200, type: PlanResponse })
  @ApiErrors('NOT_FOUND', 'INVALID_STATE')
  pick(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: LayoutOptionParams) {
    return notImplemented('FS-99');
  }

  @Get('requests/:id/plan')
  @ApiOperation({ summary: 'Blocks, sectionsLeft, previewsUsed of 5', description: 'Screen 9' })
  @ZodResponse({ type: PlanResponse })
  @ApiErrors('NOT_FOUND')
  plan(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: IdParam) {
    return notImplemented('FS-99');
  }

  @Post('requests/:id/previews')
  @RequireIdempotencyKey()
  @ApiOperation({
    summary: 'Make the next preview. The 6th and later need confirm and cost 10',
    description: 'Screen 9',
  })
  @ZodResponse({ status: 201, type: CreatePreviewResponse })
  @ApiErrors('NOT_FOUND', 'INVALID_STATE', 'NOT_ENOUGH_CREDITS', 'AI_CAP_REACHED', 'WORKSPACE_READ_ONLY', 'AGENT_OFFLINE')
  createPreview(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: IdParam, @Body() _body: CreatePreviewBody) {
    return notImplemented('FS-99');
  }

  @Get('requests/:id/previews/:n')
  @ApiOperation({ summary: 'Content JSON for the browser renderer', description: 'Screen 9' })
  @ZodResponse({ type: PreviewResponse })
  @ApiErrors('NOT_FOUND')
  preview(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: PreviewParams) {
    return notImplemented('FS-99');
  }

  @Get('requests/:id/sign-off')
  @ApiOperation({ summary: 'Summary, RM 100, 3 working days, terms text and version', description: 'Screen 11' })
  @ZodResponse({ type: SignOffResponse })
  @ApiErrors('NOT_FOUND', 'INVALID_STATE')
  signOffSummary(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: IdParam) {
    return notImplemented('FS-100');
  }

  @Post('requests/:id/sign-off')
  @RequireIdempotencyKey()
  @ApiOperation({ summary: 'Accept terms and start the build (Jira ticket, dev run)', description: 'Screen 11' })
  @ZodResponse({ status: 200, type: RequestReply })
  @ApiErrors('NOT_FOUND', 'INVALID_STATE', 'WORKSPACE_READ_ONLY')
  signOff(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: IdParam, @Body() _body: SignOffBody) {
    return notImplemented('FS-100');
  }
}
