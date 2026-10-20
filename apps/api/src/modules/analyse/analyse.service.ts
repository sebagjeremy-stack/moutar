import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { AnalyseComposition, Produit, StatutVerdict, Verdict } from '@moutar/shared-types';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';
import type { Database } from '../../database/client';
import { DRIZZLE } from '../../database/database.module';
import { additifSurcharge, verdict } from '../../database/schema';
import { ProduitsService } from '../produits/produits.service';
import { AVERTISSEMENT_COMPOSITION, SOURCE_TABLE, analyserComposition, type SurchargeAdditif } from './analyse-composition-regles';

export interface ResultatAnalyse {
  produit: Produit;
  analyse: AnalyseComposition;
  verdict: Verdict;
  avertissement: string;
}

const STATUT_VERDICT: Record<AnalyseComposition['statut'], StatutVerdict> = {
  aucun_additif_problematique: 'non_verifie',
  douteux: 'non_verifie',
  non_casher: 'non_casher',
};

@Injectable()
export class AnalyseService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly produits: ProduitsService,
  ) {}

  /** Analyse la composition d'un produit (par EAN) et enregistre le verdict de niveau 4. 409 si aucun ingrédient. */
  async analyserParEan(ean: string): Promise<ResultatAnalyse> {
    const p = await this.produits.lireParEan(ean);
    if (!this.compositionConnue(p)) {
      throw new ErreurMetier(409, 'ingredients_absents', 'Les ingrédients de ce produit ne sont pas connus : saisissez-les ou photographiez l’étiquette.', { ean });
    }
    return this.analyser(p);
  }

  compositionConnue(p: Produit): boolean {
    return Boolean(p.ingredientsTexte && p.ingredientsTexte.trim()) || p.additifs.length > 0;
  }

  /** Analyse une fiche connue et n'écrit un verdict neuf que si le résultat a changé (empreinte dans `detail`). */
  async analyser(p: Produit): Promise<ResultatAnalyse> {
    const surcharges = await this.surcharges();
    const analyse = analyserComposition({ ingredientsTexte: p.ingredientsTexte, additifsTags: p.additifs }, surcharges);
    const empreinte = createHash('sha256')
      .update(JSON.stringify([analyse.statut, analyse.additifs.map((a) => [a.code, a.statut, a.source]), analyse.ingredientsSuspects, analyse.tagsIgnores]))
      .digest('hex');
    const [dernier] = await this.db
      .select()
      .from(verdict)
      .where(and(eq(verdict.produitId, p.id), eq(verdict.niveau, 4), isNull(verdict.deletedAt)))
      .orderBy(desc(verdict.createdAt))
      .limit(1);
    let ligne = dernier;
    if (!ligne || ligne.detail['empreinte'] !== empreinte) {
      [ligne] = await this.db
        .insert(verdict)
        .values({
          produitId: p.id,
          niveau: 4,
          statut: STATUT_VERDICT[analyse.statut],
          source: SOURCE_TABLE,
          mention: mentionDe(analyse),
          publieLe: new Date(),
          detail: { empreinte, statutComposition: analyse.statut, additifs: analyse.additifs, ingredientsSuspects: analyse.ingredientsSuspects, nombreIngredients: analyse.nombreIngredients, tagsIgnores: analyse.tagsIgnores },
        })
        .returning();
    }
    return { produit: p, analyse, verdict: versVerdict(ligne), avertissement: AVERTISSEMENT_COMPOSITION };
  }

  async surcharges(): Promise<Map<string, SurchargeAdditif>> {
    const lignes = await this.db.select().from(additifSurcharge);
    return new Map(lignes.map((l) => [l.codeE, { code: l.codeE, statut: l.statut, source: l.source, note: l.note }]));
  }
}

function mentionDe(a: AnalyseComposition): string {
  if (a.statut === 'aucun_additif_problematique') return 'aucun additif repéré';
  const codes = a.additifs.filter((x) => x.statut !== 'casher').map((x) => x.code);
  const tout = [...codes, ...a.ingredientsSuspects];
  return a.statut === 'non_casher' ? `non cacher : ${tout.join(', ')}` : `douteux : ${tout.join(', ')}`;
}

export function versVerdict(l: typeof verdict.$inferSelect): Verdict {
  return {
    id: l.id,
    produitId: l.produitId,
    niveau: l.niveau as Verdict['niveau'],
    rite: l.rite,
    statut: l.statut,
    source: l.source,
    mention: l.mention,
    publieLe: l.publieLe?.toISOString() ?? null,
    valableJusquAu: l.valableJusquAu?.toISOString() ?? null,
    detail: l.detail,
    createdAt: l.createdAt.toISOString(),
  };
}
