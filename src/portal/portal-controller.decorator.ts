import { applyDecorators, Controller } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Every client-portal controller: under /portal, Bearer token, one Swagger tag. */
export function PortalController(path: string, tag: string): ClassDecorator {
  return applyDecorators(Controller(`portal/${path}`), ApiTags(tag), ApiBearerAuth());
}
