import { Injectable } from '@nestjs/common';
import { LimiteDeDebit } from '../../common/auth/limite-de-debit';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';

/** 10 contributions et 10 signalements par heure et par adresse — large pour une famille, étroit pour un robot. */
export const PROPOSITIONS_PAR_HEURE = 10;
const UNE_HEURE_MS = 60 * 60 * 1000;

/** La limite de débit des gestes publics qui ÉCRIVENT (lot 5) ; en mémoire, une seule instance ; 429 `trop_de_demandes`. */
@Injectable()
export class LimiteContributions {
  private readonly contributions = new LimiteDeDebit(PROPOSITIONS_PAR_HEURE, UNE_HEURE_MS);
  private readonly signalements = new LimiteDeDebit(PROPOSITIONS_PAR_HEURE, UNE_HEURE_MS);

  exigerContribution(adresse: string): void {
    if (!this.contributions.tenter(adresse)) throw new ErreurMetier(429, 'trop_de_demandes', 'Trop de contributions en une heure : réessayez plus tard.');
  }

  exigerSignalement(adresse: string): void {
    if (!this.signalements.tenter(adresse)) throw new ErreurMetier(429, 'trop_de_demandes', 'Trop de signalements en une heure : réessayez plus tard.');
  }
}
