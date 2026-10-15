import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

/**
 * Railway's health check. No DB call, so it never wakes Neon. Left out of
 * openapi.json: only Railway calls it.
 */
@Controller('health')
@ApiExcludeController()
export class HealthController {
  @Get()
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
