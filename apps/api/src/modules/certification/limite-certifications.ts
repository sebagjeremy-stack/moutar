import { Injectable } from '@nestjs/common';
import { LimiteDeDebit } from '../../common/auth/limite-de-debit';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';

/** 10 validations ou retraits de certification par heure et par adresse — large pour une famille, étroit pour un robot. */
export const CERTIFICATIONS_PAR_HEURE = 10;
const UNE_HEURE_MS = 60 * 60 * 1000;

/** La limite de débit des gestes publics qui ÉCRIVENT une certification (POST et DELETE) ; une instance ; 429 `trop_de_demandes`. */
@Injectable()
export class LimiteCertifications {
  private readonly parAdresse = new LimiteDeDebit(CERTIFICATIONS_PAR_HEURE, UNE_HEURE_MS);

  exiger(adresse: string): void {
    if (!this.parAdresse.tenter(adresse)) throw new ErreurMetier(429, 'trop_de_demandes', 'Trop de certifications validées ou retirées en une heure : réessayez plus tard.');
  }
}
