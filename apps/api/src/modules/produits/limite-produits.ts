import { Injectable } from '@nestjs/common';
import { LimiteDeDebit } from '../../common/auth/limite-de-debit';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';

/*
 * Les limites de débit des routes PUBLIQUES des produits (21/10/2026), par adresse, en mémoire (une instance) — LARGES
 * pour une famille, étroites pour un robot ; 429 `trop_de_demandes` :
 * - `POST /produits` (création manuelle) : 30 par heure ;
 * - `PUT /produits/:ean/ingredients` (réécriture des ingrédients) : 30 par heure ;
 * - `GET /produits/:ean/analyse` : 120 par 10 minutes ;
 * - `GET /produits/:ean` : SEULE la branche « EAN inconnu en base → appel Open Food Facts » est limitée (60 par
 *   10 minutes : on ne fait pas frapper OFF par notre adresse) ; la lecture d'une fiche en cache ne l'est pas.
 */
export const CREATIONS_PAR_HEURE = 30;
export const INGREDIENTS_PAR_HEURE = 30;
export const ANALYSES_PAR_10_MIN = 120;
export const LECTURES_OFF_PAR_10_MIN = 60;
const UNE_HEURE_MS = 60 * 60 * 1000;
const DIX_MINUTES_MS = 10 * 60 * 1000;

@Injectable()
export class LimiteProduits {
  private readonly creations = new LimiteDeDebit(CREATIONS_PAR_HEURE, UNE_HEURE_MS);
  private readonly ingredients = new LimiteDeDebit(INGREDIENTS_PAR_HEURE, UNE_HEURE_MS);
  private readonly analyses = new LimiteDeDebit(ANALYSES_PAR_10_MIN, DIX_MINUTES_MS);
  private readonly lecturesOff = new LimiteDeDebit(LECTURES_OFF_PAR_10_MIN, DIX_MINUTES_MS);

  exigerCreation(adresse: string): void {
    if (!this.creations.tenter(adresse)) throw new ErreurMetier(429, 'trop_de_demandes', 'Trop de fiches créées en une heure : réessayez plus tard.');
  }

  exigerIngredients(adresse: string): void {
    if (!this.ingredients.tenter(adresse)) throw new ErreurMetier(429, 'trop_de_demandes', 'Trop de listes d’ingrédients enregistrées en une heure : réessayez plus tard.');
  }

  exigerAnalyse(adresse: string): void {
    if (!this.analyses.tenter(adresse)) throw new ErreurMetier(429, 'trop_de_demandes', 'Trop d’analyses en dix minutes : réessayez plus tard.');
  }

  /** À appeler juste AVANT un appel à Open Food Facts pour un EAN inconnu en base — jamais pour une fiche en cache. */
  exigerLectureOff(adresse: string): void {
    if (!this.lecturesOff.tenter(adresse)) throw new ErreurMetier(429, 'trop_de_demandes', 'Trop de nouveaux codes-barres lus en dix minutes : réessayez plus tard.');
  }
}
