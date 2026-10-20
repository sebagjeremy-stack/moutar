import { Injectable } from '@nestjs/common';
import type { CarteProduit, Niveau } from '@moutar/shared-types';
import type { LigneSynthese } from '@moutar/shared-types/regles/synthese';
import { jourLocal } from '../../common/temps/jour-local';
import { AnalyseService } from '../analyse/analyse.service';
import { CertificationService } from '../certification/certification.service';
import { correspondanceListes } from '../listes/correspondance-liste-regles';
import { ListesService } from '../listes/listes.service';
import { ProduitsService } from '../produits/produits.service';
import { calculerSynthese, ligneCertifie, ligneCommunautaire, ligneComposition, ligneListeOfficielle, ligneSyntheseNiveau1, lignesSyntheseNiveau2 } from './carte-regles';

/** Un jour `AAAA-MM-JJ` reste tel quel ; un instant ISO devient le jour du centre. */
function versJourLocal(valeur: string | null): string | null {
  if (!valeur) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(valeur) ? valeur : jourLocal(new Date(valeur));
}

@Injectable()
export class CarteService {
  constructor(
    private readonly produits: ProduitsService,
    private readonly analyse: AnalyseService,
    private readonly listes: ListesService,
    private readonly certification: CertificationService,
  ) {}

  /** La carte : les quatre niveaux et la synthèse selon le seuil. La composition s'analyse dès qu'elle est connue. */
  async carte(ean: string, seuil: Niveau): Promise<CarteProduit> {
    const p = await this.produits.lireParEan(ean);
    const aujourdhui = jourLocal();
    const resultat = this.analyse.compositionConnue(p) ? await this.analyse.analyser(p) : null;
    // Niveau 2 : ce que dit chaque liste ACTIVE (règle pure) ; le verdict ne s'écrit qu'au changement.
    const sousLignes = correspondanceListes({ nom: p.nom, marque: p.marque }, await this.listes.listesActives(), aujourdhui);
    await this.listes.enregistrerVerdictsNiveau2(p.id, sousLignes);
    const niveau2 = ligneListeOfficielle(sousLignes);
    // Niveau 1 (lot 3) : la certification VALIDÉE par l'utilisateur, ou rien (jamais un « non »).
    const certification = await this.certification.lire(p.id);
    const lignes = [
      ligneCertifie(certification),
      niveau2,
      ligneCommunautaire(),
      ligneComposition(p, resultat?.analyse ?? null, resultat ? new Date(resultat.verdict.publieLe ?? resultat.verdict.createdAt) : new Date()),
    ];
    // La synthèse compare la validité d'une source au jour du CENTRE (Europe/Paris), en jours locaux des deux côtés ;
    // le niveau 2 lui donne une ligne PAR liste (chacune avec sa validité).
    const pourSynthese: LigneSynthese[] = lignes.flatMap((l) =>
      l.niveau === 1 ? [ligneSyntheseNiveau1(l, certification)] : l.niveau === 2 ? lignesSyntheseNiveau2(l) : [{ ...l, valableJusquAu: versJourLocal(l.valableJusquAu) }],
    );
    return { produit: p, seuil, lignes, synthese: calculerSynthese(pourSynthese, seuil, aujourdhui), analyse: resultat?.analyse ?? null };
  }
}
