import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, isNull, like, sql } from 'drizzle-orm';
import type { ResultatRecherche } from '@moutar/shared-types';
import { normaliser } from '@moutar/shared-types/regles/normalisation';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';
import { jourLocal } from '../../common/temps/jour-local';
import type { Database } from '../../database/client';
import { DRIZZLE } from '../../database/database.module';
import { ligneListe, listeOfficielle, produit } from '../../database/schema';
import { listePerimee } from '../listes/correspondance-liste-regles';

export const LONGUEUR_MIN_RECHERCHE = 3;
export const LIMITE_RECHERCHE = 20;

/** Pure : les mots d'une recherche, ou le refus (moins de trois caractères utiles). */
export function motsDeRecherche(q: string): string[] {
  const n = normaliser(q);
  if (n.replace(/ /g, '').length < LONGUEUR_MIN_RECHERCHE) throw new ErreurMetier(400, 'recherche_trop_courte', `Tapez au moins ${LONGUEUR_MIN_RECHERCHE} caractères.`);
  return n.split(' ').filter(Boolean);
}

/**
 * La recherche publique par nom ou marque : les produits connus ET les lignes des listes ACTIVES qui contiennent chaque mot
 * (colonnes normalisées : sans accent ni casse ; index trigram). 20 résultats de chaque. Aucune donnée personnelle.
 */
@Injectable()
export class RechercheService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async chercher(q: string): Promise<ResultatRecherche> {
    const mots = motsDeRecherche(q);
    const texteProduit = sql`${produit.nomNorm} || ' ' || ${produit.marqueNorm}`;
    const produits = await this.db
      .select({ id: produit.id, ean: produit.ean, nom: produit.nom, marque: produit.marque, imageUrl: produit.imageUrl })
      .from(produit)
      .where(and(isNull(produit.deletedAt), ...mots.map((m) => like(texteProduit, `%${m}%`))))
      .orderBy(asc(produit.nom))
      .limit(LIMITE_RECHERCHE);
    const texteLigne = sql`${ligneListe.rubriqueNorm} || ' ' || ${ligneListe.marqueNorm} || ' ' || ${ligneListe.produitNorm}`;
    const lignes = await this.db
      .select({
        id: ligneListe.id,
        listeId: ligneListe.listeId,
        code: listeOfficielle.code,
        source: listeOfficielle.titre,
        publieLe: listeOfficielle.publieLe,
        valableJusquAu: listeOfficielle.valableJusquAu,
        rubrique: ligneListe.rubrique,
        marque: ligneListe.marque,
        produitLibelle: ligneListe.produitLibelle,
        mention: ligneListe.mention,
        touteMarque: ligneListe.touteMarque,
      })
      .from(ligneListe)
      .innerJoin(listeOfficielle, eq(listeOfficielle.id, ligneListe.listeId))
      .where(and(eq(listeOfficielle.active, true), isNull(listeOfficielle.deletedAt), isNull(ligneListe.deletedAt), ...mots.map((m) => like(texteLigne, `%${m}%`))))
      .orderBy(asc(listeOfficielle.code), asc(ligneListe.ordre))
      .limit(LIMITE_RECHERCHE);
    const aujourdhui = jourLocal();
    return { q: q.trim(), produits, lignes: lignes.map((l) => ({ ...l, perimee: listePerimee(l, aujourdhui) })) };
  }
}
