import { applyDecorators, Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PortalAuthGuard } from '../auth/portal-auth.guard';

/** Every client-portal controller: under /portal, a verified client token, one Swagger tag. */
export function PortalController(path: string, tag: string): ClassDecorator {
  return applyDecorators(Controller(`portal/${path}`), UseGuards(PortalAuthGuard), ApiTags(tag), ApiBearerAuth());
}
