import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import { StudioException } from '../common/studio-exception';
import type { PortalUser } from '../common/current-workspace.decorator';
import { JWKS, requireUrl } from './jwks.provider';

/** Studio's audience in nest-foo-auth's tokens. */
export const AUDIENCE = 'studio';

const BEARER = 'Bearer ';

/**
 * Verifies nest-foo-auth's access token on every /portal route: ES256 only,
 * our issuer, our audience, an access token, a client account with its
 * client_id, and non-empty sub, email and sid.
 *
 * Every failure is the same 401 TOKEN_EXPIRED, never a hint which check
 * failed (as billing's guard). The frontend answers it with a silent refresh;
 * when that fails too, it signs the client out.
 *
 * It reads the Authorization header only: Studio has no cookie of its own.
 */
@Injectable()
export class PortalAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    @Inject(JWKS) private readonly jwks: JWTVerifyGetKey,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: PortalUser }>();
    const user = await this.readUser(request.headers.authorization);
    if (!user) throw new StudioException('TOKEN_EXPIRED');
    request.user = user;
    return true;
  }

  private async readUser(header: string | undefined): Promise<PortalUser | null> {
    if (!header?.startsWith(BEARER)) return null;
    const token = header.slice(BEARER.length).trim();
    if (!token) return null;

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        algorithms: ['ES256'],
        issuer: requireUrl(this.config, 'AUTH_ISSUER'),
        audience: AUDIENCE,
      });
      if (payload.typ !== 'access') return null;
      const { sub, email, sid, account_type: accountType, client_id: clientId } = payload;
      if (!nonEmpty(sub) || !nonEmpty(email) || !nonEmpty(sid)) return null;
      // /portal is the client portal. Staff may sign in to Studio (admin, later),
      // but they have no workspace here.
      if (accountType !== 'client') return null;
      if (typeof clientId !== 'number' || !Number.isInteger(clientId) || clientId <= 0) return null;
      return { accountId: sub, email, sid, accountType, clientId };
    } catch {
      return null;
    }
  }
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
