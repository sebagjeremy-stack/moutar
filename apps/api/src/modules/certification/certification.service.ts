import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Certificateur, CertificationProduit, MentionCertification, ResultatLectureLogo } from '@moutar/shared-types';
import { CERTIFICATEURS, CERTIFICATEURS_PAR_CODE, libelleMentionCertification } from '@moutar/shared-types/catalogues/certificateurs';
import { PropositionsEnAttente } from '../../common/auth/propositions-en-attente';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';
import { texteBrut } from '../../common/validation/texte-brut';
import type { Database } from '../../database/client';
import { DRIZZLE } from '../../database/database.module';
import { certificateurSurcharge, produit, verdict } from '../../database/schema';
import type { ImageIa } from '../ia/fournisseur-ia';
import { MoteurIa } from '../ia/moteur-ia';
import { ProduitsService } from '../produits/produits.service';
import { mentionsContradictoires } from './certification-regles';
import { CONSIGNE_LOGO, schemaLectureLogo } from './consigne-logo';
import { correspondreCertificateurs } from './correspondance-certificateur-regles';

/** Le texte lu, pour mémoire, se garde en texte brut et borné à 200 caractères. */
export const TEXTE_LU_MAX = 200;

/** Ce que l'utilisateur valide d'un clic : le jeton de la proposition, un code du catalogue, ses mentions, le texte lu. */
export interface ValidationCertification {
  jeton: string;
  code: string;
  mentions: MentionCertification[];
  texteLu: string | null;
}

type LigneVerdict = typeof verdict.$inferSelect;

/**
 * Niveau 1 (lot 3). La lecture d'un logo rend des PROPOSITIONS (rien n'est écrit) et un JETON de proposition (haché en
 * mémoire, 15 min, `PropositionsEnAttente`) ; la VALIDATION d'un clic présente le jeton, le même EAN et l'un des codes
 * proposés (sinon 400 `proposition_inconnue`), puis écrit le verdict de niveau 1 (`statut: 'cite'`, source = le
 * certificateur, `publie_le` = l'instant de la validation, `valable_jusqu_au` null, détail { certificateur, mentions,
 * texteLu, validePar: 'utilisateur' }) dans UNE transaction sous `pg_advisory_xact_lock(hashtext('produit:<id>'))`, la
 * fiche RELUE sous le verrou, l'ancienne certification retirée (doux) — « un seul verdict vivant » est tenu en plus par
 * l'index unique partiel `verdict_niveau1_vivant_uidx`. Le retrait est doux. Le catalogue EFFECTIF retire les
 * certificateurs désactivés à la console (`certificateur_surcharge`).
 */
@Injectable()
export class CertificationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly moteur: MoteurIa,
    private readonly produits: ProduitsService,
    private readonly propositions: PropositionsEnAttente,
  ) {}

  /** Les certificateurs actifs (catalogue en code, moins les désactivations de console). */
  async catalogueEffectif(): Promise<Certificateur[]> {
    const inactifs = new Set((await this.db.select().from(certificateurSurcharge).where(eq(certificateurSurcharge.actif, false))).map((s) => s.code));
    return CERTIFICATEURS.filter((c) => !inactifs.has(c.code));
  }

  /**
   * Lit une image (hors de toute transaction), puis le CODE fait la correspondance : des propositions, jamais un verdict ;
   * un jeton de proposition quand il y en a (lié à l'EAN donné ; sans produit, il ne fonde aucune validation).
   */
  async lireLogo(image: ImageIa, ean: string | null): Promise<ResultatLectureLogo> {
    const lecture = await this.moteur.lireImage(image, CONSIGNE_LOGO, schemaLectureLogo, 'lecture_logo');
    const resultat = correspondreCertificateurs(lecture.valeur, await this.catalogueEffectif());
    const jeton = resultat.propositions.length > 0 ? this.propositions.emettre({ ean, codes: resultat.propositions.map((p) => p.code) }) : null;
    return { ...resultat, jeton };
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

  /**
   * La validation d'un clic : le code doit être du catalogue ET actif, les mentions ne pas se contredire, le jeton
   * correspondre (consommé juste avant la transaction) ; l'ancienne certification du produit est retirée (doux) sous le
   * verrou du produit, la fiche relue (404 si elle a été retirée entre-temps).
   */
  async valider(ean: string, v: ValidationCertification): Promise<CertificationProduit> {
    const p = await this.produits.lireParEan(ean);
    const catalogue = await this.catalogueEffectif();
    const c = catalogue.find((x) => x.code === v.code);
    if (!c) {
      const connu = CERTIFICATEURS_PAR_CODE.has(v.code);
      throw new ErreurMetier(connu ? 409 : 400, connu ? 'certificateur_desactive' : 'certificateur_inconnu', connu ? 'Cet organisme a été désactivé à la console : il ne peut plus fonder une certification.' : 'Organisme inconnu du catalogue.', { certificateur: v.code });
    }
    const mentions = [...new Set(v.mentions.filter((m) => c.mentionsPossibles.includes(m)))];
    if (mentionsContradictoires(mentions)) {
      throw new ErreurMetier(400, 'mentions_contradictoires', 'Un logo ne dit pas à la fois parvé, halavi ou lait non surveillé : gardez une seule de ces mentions.', { mentions });
    }
    // Le jeton se consomme en un pas synchrone : deux validations concurrentes de la même lecture n'en font qu'une.
    if (!this.propositions.consommer(v.jeton, ean, c.code)) {
      throw new ErreurMetier(400, 'proposition_inconnue', 'La proposition a expiré ou ne correspond pas à ce produit : reprenez la photo.');
    }
    const texteLu = v.texteLu ? texteBrut(v.texteLu).slice(0, TEXTE_LU_MAX) || null : null;
    const ligne = await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`produit:${p.id}`}))`);
      const [vivante] = await tx
        .select({ id: produit.id })
        .from(produit)
        .where(and(eq(produit.id, p.id), isNull(produit.deletedAt)))
        .limit(1);
      if (!vivante) throw new ErreurMetier(404, 'produit_inconnu', 'Produit inconnu.', { ean });
      const maintenant = new Date();
      await tx
        .update(verdict)
        .set({ deletedAt: maintenant })
        .where(and(eq(verdict.produitId, p.id), eq(verdict.niveau, 1), isNull(verdict.deletedAt)));
      const [creee] = await tx
        .insert(verdict)
        .values({
          produitId: p.id,
          niveau: 1,
          statut: 'cite',
          source: c.nom,
          mention: mentions.map((m) => libelleMentionCertification(m)).join(' · ') || null,
          publieLe: maintenant,
          valableJusquAu: null,
          detail: { certificateur: c.code, mentions, texteLu, validePar: 'utilisateur' },
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
