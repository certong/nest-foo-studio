import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { StudioException } from './studio-exception';

/** The claims PortalAuthGuard verified on nest-foo-auth's access token. */
export interface PortalUser {
  /** The auth account id (`sub`), written to audit_log. */
  accountId: string;
  email: string;
  /** The login session (`sid`), ties Studio actions to auth_event. */
  sid: string;
  accountType: 'client';
  clientId: number;
}

/** Who is calling and which workspace they act on. Services resolve the row from clientId. */
export interface WorkspaceScope {
  /** = workspace.id = billing.client.id. */
  clientId: number;
  accountId: string;
  email: string;
}

function isPortalUser(user: unknown): user is PortalUser {
  return (
    typeof user === 'object' &&
    user !== null &&
    'accountType' in user &&
    user.accountType === 'client' &&
    'clientId' in user &&
    typeof user.clientId === 'number' &&
    'accountId' in user &&
    typeof user.accountId === 'string' &&
    'email' in user &&
    typeof user.email === 'string'
  );
}

/**
 * The only way a portal handler learns its workspace: from the token's
 * client_id, never from the URL or body.
 */
export const CurrentWorkspace = createParamDecorator((_: unknown, ctx: ExecutionContext): WorkspaceScope => {
  const user: unknown = ctx.switchToHttp().getRequest<Request & { user?: unknown }>().user;
  if (!isPortalUser(user)) throw new StudioException('TOKEN_EXPIRED');
  return { clientId: user.clientId, accountId: user.accountId, email: user.email };
});
