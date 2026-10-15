import { Body, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { ApiErrors } from '../common/api-errors.decorator';
import { CurrentWorkspace, type WorkspaceScope } from '../common/current-workspace.decorator';
import { RequireIdempotencyKey } from '../common/idempotency-key.decorator';
import { notImplemented } from '../common/studio-exception';
import { ApproveBody, ChangesResponse, FixBody, IdParam, PatchReviewBody, RequestReply, ReviewResponse } from './dto';
import { PortalController } from './portal-controller.decorator';

@PortalController('requests/:id', 'Change lane')
export class ChangesController {
  @Get('changes')
  @ApiOperation({ summary: 'Change list old → new, "3 of 10", credits held', description: 'Screen 7' })
  @ZodResponse({ type: ChangesResponse })
  @ApiErrors('NOT_FOUND', 'INVALID_STATE')
  changes(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: IdParam) {
    return notImplemented('FS-97');
  }

  @Get('review')
  @ApiOperation({ summary: 'Each change: Now vs After, per language, page link', description: 'Screen 10' })
  @ZodResponse({ type: ReviewResponse })
  @ApiErrors('NOT_FOUND', 'INVALID_STATE')
  review(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: IdParam) {
    return notImplemented('FS-97');
  }

  @Patch('review')
  @ApiOperation({ summary: '"Update Malay too / English only" per change', description: 'Screen 10' })
  @ZodResponse({ type: ReviewResponse })
  @ApiErrors('NOT_FOUND', 'INVALID_STATE')
  patchReview(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: IdParam, @Body() _body: PatchReviewBody) {
    return notImplemented('FS-97');
  }

  @Post('approve')
  @RequireIdempotencyKey()
  @ApiOperation({
    summary: 'Apply the patch and run checks; 20 credits charged on pass, then publish',
    description: 'Screen 10. A failed check releases the hold and the request goes On Hold.',
  })
  @ZodResponse({ status: 200, type: RequestReply })
  @ApiErrors('NOT_FOUND', 'INVALID_STATE', 'STALE_PATCH', 'NOT_ENOUGH_CREDITS', 'WORKSPACE_READ_ONLY')
  approve(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: IdParam, @Body() _body: ApproveBody) {
    return notImplemented('FS-98');
  }

  @Post('fix')
  @ApiOperation({ summary: '"Ask agent-ba to fix": back to chat with a note', description: 'Screen 10' })
  @ZodResponse({ status: 200, type: RequestReply })
  @ApiErrors('NOT_FOUND', 'INVALID_STATE', 'LIMIT_REACHED')
  fix(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: IdParam, @Body() _body: FixBody) {
    return notImplemented('FS-97');
  }
}
