import { Body, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { ApiErrors } from '../common/api-errors.decorator';
import { CurrentWorkspace, type WorkspaceScope } from '../common/current-workspace.decorator';
import { RequireIdempotencyKey } from '../common/idempotency-key.decorator';
import { notImplemented } from '../common/studio-exception';
import { CreateTopupBody, CreditsResponse, IdParam, LedgerQuery, LedgerResponse, TopupList, TopupReply } from './dto';
import { PortalController } from './portal-controller.decorator';

@PortalController('', 'Credits and top-up')
export class CreditsController {
  @Get('credits')
  @ApiOperation({ summary: 'Both buckets, held, usage by type and month, price list', description: 'Screen 5' })
  @ZodResponse({ type: CreditsResponse })
  @ApiErrors()
  credits(@CurrentWorkspace() _ws: WorkspaceScope) {
    return notImplemented('FS-93');
  }

  @Get('credits/ledger')
  @ApiOperation({ summary: '"This month" timeline (+200, −20, −15, 20 set aside)', description: 'Screen 5' })
  @ZodResponse({ type: LedgerResponse })
  @ApiErrors()
  ledger(@CurrentWorkspace() _ws: WorkspaceScope, @Query() _query: LedgerQuery) {
    return notImplemented('FS-93');
  }

  @Post('topups')
  @RequireIdempotencyKey()
  @ApiOperation({ summary: 'Request a top-up; reply carries DuitNow and bank details', description: 'Screens 5, 14' })
  @ZodResponse({ status: 201, type: TopupReply })
  @ApiErrors('INVALID_STATE', 'WORKSPACE_READ_ONLY')
  createTopup(@CurrentWorkspace() _ws: WorkspaceScope, @Body() _body: CreateTopupBody) {
    return notImplemented('FS-95');
  }

  @Get('topups')
  @ApiOperation({ summary: 'Top-ups, including any "Waiting for payment"', description: 'Screen 5' })
  @ZodResponse({ type: TopupList })
  @ApiErrors()
  topups(@CurrentWorkspace() _ws: WorkspaceScope) {
    return notImplemented('FS-95');
  }

  @Post('topups/:id/cancel')
  @ApiOperation({ summary: 'Cancel before Chi approves', description: 'Screen 5' })
  @ZodResponse({ status: 200, type: TopupReply })
  @ApiErrors('NOT_FOUND', 'INVALID_STATE')
  cancelTopup(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: IdParam) {
    return notImplemented('FS-95');
  }
}
