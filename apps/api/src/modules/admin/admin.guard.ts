import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { lireCookie } from '../../common/auth/cookies';
import { COOKIE_ADMIN } from './session-admin';
import { AdminService, type SessionLue } from './admin.service';

export interface RequeteAdmin {
  headers: Record<string, unknown>;
  admin?: SessionLue;
}

/**
 * La garde de la console : la session est RELUE en base à chaque requête. Sans cookie : 401 (l'écran renvoie à la
 * connexion) ; cookie présent mais session inconnue, expirée ou révoquée : 403 explicite.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly admin: AdminService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequeteAdmin>();
    const entete = req.headers['cookie'];
    const jeton = lireCookie(typeof entete === 'string' ? entete : undefined, COOKIE_ADMIN);
    if (!jeton) throw new UnauthorizedException({ code: 'non_connecte', message: 'Connexion requise.' });
    const session = await this.admin.sessionDepuisJeton(jeton);
    if (!session) throw new ForbiddenException({ code: 'session_invalide', message: 'Session expirée ou révoquée : reconnectez-vous.' });
    req.admin = session;
    return true;
  }
}
