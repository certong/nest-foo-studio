import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { StudioException } from './studio-exception';

/**
 * The claims Studio reads from a verified auth-service token. The JWKS guard
 * that verifies the token and sets request.user arrives with FS-86.
 */
export interface PortalUser {
  accountType: 'client';
  clientId: number;
}

/** Which workspace a portal call acts on. Services resolve the row from it. */
export interface WorkspaceScope {
  clientId: number;
}

function isPortalUser(user: unknown): user is PortalUser {
  return (
    typeof user === 'object' &&
    user !== null &&
    'accountType' in user &&
    user.accountType === 'client' &&
    'clientId' in user &&
    typeof user.clientId === 'number'
  );
}

/**
 * The only way a portal handler learns its workspace: from the token's
 * client_id, never from the URL or body.
 */
export const CurrentWorkspace = createParamDecorator((_: unknown, ctx: ExecutionContext): WorkspaceScope => {
  const user: unknown = ctx.switchToHttp().getRequest<Request & { user?: unknown }>().user;
  if (!isPortalUser(user)) throw new StudioException('TOKEN_EXPIRED');
  return { clientId: user.clientId };
});
