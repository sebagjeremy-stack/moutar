import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';

/**
 * Filtre d'erreurs : une réponse JSON `{ code, message }` en français, 403 explicite, 400 sur une validation zod ou un
 * JSON illisible, 413 sur un corps trop grand (body-parser), jamais une trace de pile servie au client.
 */
@Catch()
export class FiltreErreurs implements ExceptionFilter {
  private readonly logger = new Logger('Erreurs');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const corpsIllisible = erreurDuBodyParser(exception);
    if (corpsIllisible) {
      res.status(corpsIllisible.statut).json({ code: corpsIllisible.code, message: corpsIllisible.message });
      return;
    }
    if (exception instanceof ZodError) {
      res.status(400).json({ code: 'requete_invalide', message: 'Requête invalide.', details: exception.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
      return;
    }
    if (exception instanceof HttpException) {
      const statut = exception.getStatus();
      const corps = exception.getResponse();
      const detail = typeof corps === 'object' && corps !== null ? (corps as Record<string, unknown>) : { message: String(corps) };
      const code = typeof detail['code'] === 'string' ? detail['code'] : codeParDefaut(statut);
      const message = typeof detail['message'] === 'string' ? detail['message'] : messageParDefaut(statut);
      res.status(statut).json({ ...detail, code, message });
      return;
    }
    this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : String(exception));
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ code: 'erreur_interne', message: 'Erreur interne : réessayez dans un instant.' });
  }
}

/**
 * Pure : les erreurs du body-parser d'Express (avant Nest) — `entity.too.large` → 413 ; JSON illisible → 400. Nest
 * transforme déjà le `SyntaxError` du body-parser en `BadRequestException(message)` SANS `code` (`routes-resolver`,
 * `mapExternalException`) : une 400 sans code est donc celle-là — nos propres 400 portent toujours un code.
 */
export function erreurDuBodyParser(exception: unknown): { statut: number; code: string; message: string } | null {
  if (typeof exception !== 'object' || exception === null) return null;
  const illisible = { statut: 400, code: 'requete_invalide', message: 'Requête invalide : le contenu envoyé n’est pas du JSON lisible.' };
  if (exception instanceof HttpException) {
    if (exception.getStatus() !== 400) return null;
    const corps = exception.getResponse();
    const code = typeof corps === 'object' && corps !== null ? (corps as Record<string, unknown>)['code'] : undefined;
    return typeof code === 'string' ? null : illisible;
  }
  const e = exception as { type?: unknown; status?: unknown };
  if (e.type === 'entity.too.large' || e.status === 413) return { statut: 413, code: 'corps_trop_grand', message: 'Le contenu envoyé est trop grand.' };
  if (e.type === 'entity.parse.failed' || exception instanceof SyntaxError) return illisible;
  return null;
}

function codeParDefaut(statut: number): string {
  if (statut === 401) return 'non_connecte';
  if (statut === 403) return 'refuse';
  if (statut === 404) return 'introuvable';
  if (statut === 429) return 'trop_de_demandes';
  return 'erreur';
}

function messageParDefaut(statut: number): string {
  if (statut === 401) return 'Connexion requise.';
  if (statut === 403) return 'Accès refusé : cette session ne permet pas ce geste.';
  if (statut === 404) return 'Introuvable.';
  if (statut === 429) return 'Trop de demandes : patientez un instant, puis réessayez.';
  return 'Erreur.';
}
