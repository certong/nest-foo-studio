import { Body, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { ApiErrors } from '../common/api-errors.decorator';
import { CurrentWorkspace, type WorkspaceScope } from '../common/current-workspace.decorator';
import { notImplemented } from '../common/studio-exception';
import {
  CreateRequestBody,
  CreateRequestResponse,
  HomeResponse,
  IdParam,
  ListRequestsQuery,
  ListRequestsResponse,
  MeResponse,
  RequestDetail,
  RequestsSummaryResponse,
} from './dto';
import { PortalController } from './portal-controller.decorator';

@PortalController('', 'Home, requests and progress')
export class RequestsController {
  @Get('me')
  @ApiOperation({ summary: 'Account, workspace, site domain, status, credit meter', description: 'Screen 3, nav' })
  @ZodResponse({ type: MeResponse })
  @ApiErrors()
  me(@CurrentWorkspace() _ws: WorkspaceScope) {
    return notImplemented('FS-86');
  }

  @Get('home')
  @ApiOperation({ summary: 'One focus action, requests waiting for the client, credits per month', description: 'Screen 3' })
  @ZodResponse({ type: HomeResponse })
  @ApiErrors()
  home(@CurrentWorkspace() _ws: WorkspaceScope) {
    return notImplemented('FS-88');
  }

  @Get('requests')
  @ApiOperation({ summary: 'Request cards with badge, steps and replyBy; count per tab', description: 'Screen 4' })
  @ZodResponse({ type: ListRequestsResponse })
  @ApiErrors()
  list(@CurrentWorkspace() _ws: WorkspaceScope, @Query() _query: ListRequestsQuery) {
    return notImplemented('FS-89');
  }

  // Before requests/:id, so "summary" is not read as an id.
  @Get('requests/summary')
  @ApiOperation({ summary: 'Past request totals (changes done, pages live)', description: 'Screen 4b' })
  @ZodResponse({ type: RequestsSummaryResponse })
  @ApiErrors()
  summary(@CurrentWorkspace() _ws: WorkspaceScope) {
    return notImplemented('FS-90');
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Detail, dated timeline, what was signed off, actions allowed now', description: 'Screen 13' })
  @ZodResponse({ type: RequestDetail })
  @ApiErrors('NOT_FOUND')
  detail(@CurrentWorkspace() _ws: WorkspaceScope, @Param() _params: IdParam) {
    return notImplemented('FS-91');
  }

  @Post('requests')
  @ApiOperation({ summary: 'New draft plus agent-ba’s greeting', description: 'Screen 6' })
  @ZodResponse({ status: 201, type: CreateRequestResponse })
  @ApiErrors('WORKSPACE_READ_ONLY')
  create(@CurrentWorkspace() _ws: WorkspaceScope, @Body() _body: CreateRequestBody) {
    return notImplemented('FS-35');
  }
}
