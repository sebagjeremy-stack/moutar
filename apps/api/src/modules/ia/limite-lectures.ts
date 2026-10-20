import { Injectable } from '@nestjs/common';
import { LimiteDeDebit } from '../../common/auth/limite-de-debit';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';

/** 30 lectures d'image (logo et OCR confondus) par 10 minutes et par adresse — large pour une famille, étroit pour un robot. */
export const LECTURES_PAR_FENETRE = 30;
export const FENETRE_LECTURES_MS = 10 * 60 * 1000;

/** La limite de débit des lectures d'image, partagée par les routes du logo et de l'OCR ; 429 `trop_de_lectures`. */
@Injectable()
export class LimiteLectures {
  private readonly parAdresse = new LimiteDeDebit(LECTURES_PAR_FENETRE, FENETRE_LECTURES_MS);

  exiger(adresse: string): void {
    if (!this.parAdresse.tenter(adresse)) throw new ErreurMetier(429, 'trop_de_lectures', 'Trop de photos lues en peu de temps : patientez quelques minutes.');
  }
}
