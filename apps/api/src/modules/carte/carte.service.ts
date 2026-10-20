import { Injectable } from '@nestjs/common';
import type { CarteProduit, Niveau } from '@moutar/shared-types';
import { calculerSynthese, type LigneSynthese } from '@moutar/shared-types/regles/synthese';
import { jourLocal } from '../../common/temps/jour-local';
import { AnalyseService } from '../analyse/analyse.service';
import { ProduitsService } from '../produits/produits.service';
import { ligneCertifie, ligneCommunautaire, ligneComposition, ligneListeOfficielle } from './carte-regles';

@Injectable()
export class CarteService {
  constructor(
    private readonly produits: ProduitsService,
    private readonly analyse: AnalyseService,
  ) {}

  /** La carte : les quatre niveaux et la synthèse selon le seuil. La composition s'analyse dès qu'elle est connue. */
  async carte(ean: string, seuil: Niveau): Promise<CarteProduit> {
    const p = await this.produits.lireParEan(ean);
    const resultat = this.analyse.compositionConnue(p) ? await this.analyse.analyser(p) : null;
    const lignes = [
      ligneCertifie(),
      ligneListeOfficielle(),
      ligneCommunautaire(),
      ligneComposition(p, resultat?.analyse ?? null, resultat ? new Date(resultat.verdict.publieLe ?? resultat.verdict.createdAt) : new Date()),
    ];
    // La synthèse compare la validité d'une source au jour du CENTRE (Europe/Paris), en jours locaux des deux côtés.
    const pourSynthese: LigneSynthese[] = lignes.map((l) => ({ ...l, valableJusquAu: l.valableJusquAu ? jourLocal(new Date(l.valableJusquAu)) : null }));
    return { produit: p, seuil, lignes, synthese: calculerSynthese(pourSynthese, seuil, jourLocal()), analyse: resultat?.analyse ?? null };
  }
}
