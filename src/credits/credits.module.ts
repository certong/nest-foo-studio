import { Module } from '@nestjs/common';
import { WorkspaceCache } from './workspace-cache';

/**
 * Credits (FS-92). The module that writes credits owns the /portal/me cache it
 * has to invalidate; the portal reads through it.
 */
@Module({
  providers: [WorkspaceCache],
  exports: [WorkspaceCache],
})
export class CreditsModule {}
