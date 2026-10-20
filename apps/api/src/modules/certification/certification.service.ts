import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Certificateur, CertificationProduit, MentionCertification, ResultatLectureLogo } from '@moutar/shared-types';
import { CERTIFICATEURS, CERTIFICATEURS_PAR_CODE, libelleMentionCertification } from '@moutar/shared-types/catalogues/certificateurs';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';
import type { Database } from '../../database/client';
import { DRIZZLE } from '../../database/database.module';
import { certificateurSurcharge, verdict } from '../../database/schema';
import type { ImageIa } from '../ia/fournisseur-ia';
import { MoteurIa } from '../ia/moteur-ia';
import { ProduitsService } from '../produits/produits.service';
import { CONSIGNE_LOGO, schemaLectureLogo } from './consigne-logo';
import { correspondreCertificateurs } from './correspondance-certificateur-regles';

/** Ce que l'utilisateur valide d'un clic : un code du catalogue, ses mentions, le texte lu (pour mémoire). */
export interface ValidationCertification {
  code: string;
  mentions: MentionCertification[];
  texteLu: string | null;
}

type LigneVerdict = typeof verdict.$inferSelect;

/**
 * Niveau 1 (lot 3). La lecture d'un logo rend des PROPOSITIONS (rien n'est écrit) ; la VALIDATION d'un clic écrit le
 * verdict de niveau 1 (`statut: 'cite'`, source = le certificateur, `publie_le` = l'instant de la validation,
 * `valable_jusqu_au` null, détail { certificateur, mentions, texteLu, validePar: 'utilisateur' }) ; le retrait est doux.
 * Le catalogue EFFECTIF retire les certificateurs désactivés à la console (`certificateur_surcharge`).
 */
@Injectable()
export class CertificationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly moteur: MoteurIa,
    private readonly produits: ProduitsService,
  ) {}

  /** Les certificateurs actifs (catalogue en code, moins les désactivations de console). */
  async catalogueEffectif(): Promise<Certificateur[]> {
    const inactifs = new Set((await this.db.select().from(certificateurSurcharge).where(eq(certificateurSurcharge.actif, false))).map((s) => s.code));
    return CERTIFICATEURS.filter((c) => !inactifs.has(c.code));
  }

  /** Lit une image (hors de toute transaction), puis le CODE fait la correspondance : des propositions, jamais un verdict. */
  async lireLogo(image: ImageIa): Promise<ResultatLectureLogo> {
    const lecture = await this.moteur.lireImage(image, CONSIGNE_LOGO, schemaLectureLogo, 'lecture_logo');
    return correspondreCertificateurs(lecture.valeur, await this.catalogueEffectif());
  }

  /** La certification validée d'un produit (le dernier verdict vivant de niveau 1), ou null. */
  async lire(produitId: string): Promise<CertificationProduit | null> {
    const [l] = await this.db
      .select()
      .from(verdict)
      .where(and(eq(verdict.produitId, produitId), eq(verdict.niveau, 1), isNull(verdict.deletedAt)))
      .orderBy(desc(verdict.createdAt))
      .limit(1);
    if (!l) return null;
    return this.versCertification(l, await this.catalogueEffectif());
  }

  async lireParEan(ean: string): Promise<CertificationProduit | null> {
    const p = await this.produits.lireParEan(ean);
    return this.lire(p.id);
  }

  /** La validation d'un clic : le code doit être du catalogue ET actif ; l'ancienne certification du produit est retirée (doux). */
  async valider(ean: string, v: ValidationCertification): Promise<CertificationProduit> {
    const p = await this.produits.lireParEan(ean);
    const catalogue = await this.catalogueEffectif();
    const c = catalogue.find((x) => x.code === v.code);
    if (!c) {
      const connu = CERTIFICATEURS_PAR_CODE.has(v.code);
      throw new ErreurMetier(connu ? 409 : 400, connu ? 'certificateur_desactive' : 'certificateur_inconnu', connu ? 'Cet organisme a été désactivé à la console : il ne peut plus fonder une certification.' : 'Organisme inconnu du catalogue.', { certificateur: v.code });
    }
    const mentions = v.mentions.filter((m) => c.mentionsPossibles.includes(m));
    const ligne = await this.db.transaction(async (tx) => {
      await tx
        .update(verdict)
        .set({ deletedAt: new Date() })
        .where(and(eq(verdict.produitId, p.id), eq(verdict.niveau, 1), isNull(verdict.deletedAt)));
      const [creee] = await tx
        .insert(verdict)
        .values({
          produitId: p.id,
          niveau: 1,
          statut: 'cite',
          source: c.nom,
          mention: mentions.map((m) => libelleMentionCertification(m)).join(' · ') || null,
          publieLe: new Date(),
          valableJusquAu: null,
          detail: { certificateur: c.code, mentions, texteLu: v.texteLu, validePar: 'utilisateur' },
        })
        .returning();
      return creee;
    });
    return this.versCertification(ligne, catalogue);
  }

  /** Retrait doux de la certification validée ; 404 `certification_absente` s'il n'y en a pas. */
  async retirer(ean: string): Promise<{ ok: true }> {
    const p = await this.produits.lireParEan(ean);
    const retirees = await this.db
      .update(verdict)
      .set({ deletedAt: new Date() })
      .where(and(eq(verdict.produitId, p.id), eq(verdict.niveau, 1), isNull(verdict.deletedAt)))
      .returning({ id: verdict.id });
    if (retirees.length === 0) throw new ErreurMetier(404, 'certification_absente', 'Aucune certification validée pour ce produit.');
    return { ok: true };
  }

  private versCertification(l: LigneVerdict, actifs: Certificateur[]): CertificationProduit {
    const code = typeof l.detail['certificateur'] === 'string' ? l.detail['certificateur'] : '';
    const c = CERTIFICATEURS_PAR_CODE.get(code);
    const mentions = (Array.isArray(l.detail['mentions']) ? l.detail['mentions'] : []).filter((m): m is MentionCertification => typeof m === 'string' && libelleMentionCertification(m) !== null);
    return {
      verdictId: l.id,
      code,
      nom: c?.nom ?? l.source,
      nomCourt: c?.nomCourt ?? l.source,
      mentions,
      mentionsLibelles: mentions.map((m) => libelleMentionCertification(m)!),
      texteLu: typeof l.detail['texteLu'] === 'string' ? l.detail['texteLu'] : null,
      publieLe: (l.publieLe ?? l.createdAt).toISOString(),
      certificateurActif: actifs.some((x) => x.code === code),
    };
  }
}
