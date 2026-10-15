import { Body, Get, Param, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { ApiErrors } from '../common/api-errors.decorator';
import { CurrentWorkspace, type WorkspaceScope } from '../common/current-workspace.decorator';
import { RequireIdempotencyKey } from '../common/idempotency-key.decorator';
import { notImplemented } from '../common/studio-exception';
import { IdParam, RequestReply, UatFeedbackBody, UatResponse } from './dto';
import { PortalController } from './portal-controller.decorator';

@PortalController('requests/:id/uat', 'Preview review (UAT)')
export class UatController {
  @Get()
  @ApiOperation({ summary: 'Preview URL, replyBy, freeRoundsLeft', description: 'Screen 12' })
  @ZodResponse({ type: UatResponse })
  @ApiErrors('NOT_FOUND', 'INVALID_STATE')
  uat(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: IdParam) {
    return notImplemented('FS-101');
  }

  @Post('approve')
  @RequireIdempotencyKey()
  @ApiOperation({ summary: 'Merge to main and go live', description: 'Screen 12' })
  @ZodResponse({ status: 200, type: RequestReply })
  @ApiErrors('NOT_FOUND', 'INVALID_STATE', 'WORKSPACE_READ_ONLY')
  approve(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: IdParam) {
    return notImplemented('FS-101');
  }

  @Post('feedback')
  @ApiOperation({ summary: 'Send notes; uses the 1 free round', description: 'Screen 12' })
  @ZodResponse({ status: 200, type: RequestReply })
  @ApiErrors('NOT_FOUND', 'INVALID_STATE', 'LIMIT_REACHED')
  feedback(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: IdParam, @Body() _body: UatFeedbackBody) {
    return notImplemented('FS-101');
  }
}
