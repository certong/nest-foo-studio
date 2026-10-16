import { Module } from '@nestjs/common';
import { jwksProvider } from './jwks.provider';
import { PortalAuthGuard } from './portal-auth.guard';

@Module({
  providers: [jwksProvider, PortalAuthGuard],
  exports: [jwksProvider, PortalAuthGuard],
})
export class AuthModule {}
