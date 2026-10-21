import { Module } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { WorkspaceCache } from './workspace-cache';

/**
 * Credits (FS-92). The module that writes credits owns the /portal/me cache it
 * has to invalidate; the portal reads through it.
 */
@Module({
  providers: [CreditsService, WorkspaceCache],
  exports: [CreditsService, WorkspaceCache],
})
export class CreditsModule {}
