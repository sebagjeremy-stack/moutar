import { HttpException } from '@nestjs/common';

/**
 * Une erreur métier porte un CODE stable lu par l'écran (`{ code, message }`) : `produit_inconnu` (404),
 * `source_indisponible` (503), `identifiants_invalides` (401), `trop_de_demandes` (429)…
 */
export class ErreurMetier extends HttpException {
  constructor(statut: number, code: string, message: string, extra: Record<string, unknown> = {}) {
    super({ code, message, ...extra }, statut);
  }
}
