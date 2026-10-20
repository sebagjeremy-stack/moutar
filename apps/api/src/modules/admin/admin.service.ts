import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import type { Additif, StatutAdditif } from '@moutar/shared-types';
import { ADDITIFS } from '@moutar/shared-types/catalogues/additifs';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';
import { LimiteDeDebit } from '../../common/auth/limite-de-debit';
import type { Database } from '../../database/client';
import { DRIZZLE } from '../../database/database.module';
import { additifSurcharge, compteAdmin, journalAdmin, sessionAdmin } from '../../database/schema';
import { HASH_LEURRE, verifierMotDePasse } from './mot-de-passe';
import { DUREE_SESSION_MS, genererJeton, hacherJeton } from './session-admin';

export interface SessionLue {
  sessionId: string;
  compteId: string;
  email: string;
  nom: string;
}

/** Une ligne de la console : le catalogue EN CODE, fusionné à sa surcharge. */
export interface AdditifConsole extends Additif {
  surcharge: { statut: StatutAdditif; source: string; note: string | null; updatedAt: string } | null;
  /** Le statut effectif (surcharge, sinon catalogue). */
  statutEffectif: StatutAdditif;
}

const FENETRE_MS = 15 * 60 * 1000;
const ESSAIS = 10;

/** Pure : un e-mail tronqué pour le journal (« adm…@exemple.fr ») — jamais l'adresse entière d'un essai refusé. */
export function tronquerEmail(email: string): string {
  const arobase = email.lastIndexOf('@');
  const local = arobase === -1 ? email : email.slice(0, arobase);
  const domaine = arobase === -1 ? '' : email.slice(arobase + 1);
  return `${local.slice(0, 3)}…@${domaine}`;
}

@Injectable()
export class AdminService {
  /** 10 essais par quart d'heure, par e-mail ET par adresse. */
  private readonly parEmail = new LimiteDeDebit(ESSAIS, FENETRE_MS);
  private readonly parAdresse = new LimiteDeDebit(ESSAIS, FENETRE_MS);

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Connexion : réponse identique que le compte existe ou non ; rend le jeton (à poser en cookie). */
  async connexion(emailBrut: string, motDePasse: string, adresse: string): Promise<{ jeton: string; session: SessionLue }> {
    const email = emailBrut.trim().toLowerCase();
    if (!this.parEmail.tenter(email) || !this.parAdresse.tenter(adresse)) {
      throw new ErreurMetier(429, 'trop_de_demandes', 'Trop d’essais : patientez un quart d’heure.');
    }
    const [compte] = await this.db.select().from(compteAdmin).where(and(eq(compteAdmin.email, email), isNull(compteAdmin.deletedAt))).limit(1);
    const valide = (await verifierMotDePasse(motDePasse, compte?.motDePasseHash ?? HASH_LEURRE)) && Boolean(compte?.actif);
    if (!compte || !valide) {
      // Un échec s'écrit au journal, sans compte et sans l'adresse entière ; la réponse reste identique que le compte existe ou non.
      await this.journaliser(null, 'connexion.refusee', null, { email: tronquerEmail(email), ip: adresse });
      throw new ErreurMetier(401, 'identifiants_invalides', 'Adresse ou mot de passe incorrect.');
    }
    // Une connexion réussie remet les compteurs à zéro (e-mail et adresse).
    this.parEmail.oublier(email);
    this.parAdresse.oublier(adresse);

    const jeton = genererJeton();
    const [s] = await this.db
      .insert(sessionAdmin)
      .values({ compteId: compte.id, jetonHash: hacherJeton(jeton), expireLe: new Date(Date.now() + DUREE_SESSION_MS) })
      .returning({ id: sessionAdmin.id });
    await this.journaliser(compte.id, 'connexion', null, {});
    return { jeton, session: { sessionId: s.id, compteId: compte.id, email: compte.email, nom: compte.nom } };
  }

  /** La session d'un jeton, relue en base : vivante, non expirée, compte actif. */
  async sessionDepuisJeton(jeton: string): Promise<SessionLue | null> {
    const [l] = await this.db
      .select({ sessionId: sessionAdmin.id, compteId: compteAdmin.id, email: compteAdmin.email, nom: compteAdmin.nom })
      .from(sessionAdmin)
      .innerJoin(compteAdmin, eq(compteAdmin.id, sessionAdmin.compteId))
      .where(and(eq(sessionAdmin.jetonHash, hacherJeton(jeton)), isNull(sessionAdmin.revoqueeLe), gt(sessionAdmin.expireLe, new Date()), eq(compteAdmin.actif, true), isNull(compteAdmin.deletedAt)))
      .limit(1);
    return l ?? null;
  }

  async deconnexion(session: SessionLue): Promise<void> {
    await this.db.update(sessionAdmin).set({ revoqueeLe: new Date() }).where(eq(sessionAdmin.id, session.sessionId));
    await this.journaliser(session.compteId, 'deconnexion', null, {});
  }

  /** Le catalogue fusionné aux surcharges. */
  async additifs(): Promise<AdditifConsole[]> {
    const surcharges = await this.db.select().from(additifSurcharge);
    const parCode = new Map(surcharges.map((s) => [s.codeE, s]));
    const connus = new Set(ADDITIFS.map((a) => a.code));
    const lignes: AdditifConsole[] = ADDITIFS.map((a) => {
      const s = parCode.get(a.code);
      return { ...a, surcharge: s ? { statut: s.statut, source: s.source, note: s.note, updatedAt: s.updatedAt.toISOString() } : null, statutEffectif: s?.statut ?? a.statut };
    });
    // Une surcharge posée sur un code hors catalogue (ajout de console) reste visible.
    for (const s of surcharges) {
      if (connus.has(s.codeE)) continue;
      lignes.push({
        code: s.codeE,
        nom: s.codeE,
        famille: 'hors catalogue',
        statut: 'inconnu',
        origineAnimalePossible: false,
        note: '',
        source: '',
        surcharge: { statut: s.statut, source: s.source, note: s.note, updatedAt: s.updatedAt.toISOString() },
        statutEffectif: s.statut,
      });
    }
    return lignes;
  }

  /** Pose ou remplace la surcharge d'un additif ; journalisée. */
  async surchargerAdditif(code: string, valeurs: { statut: StatutAdditif; source: string; note: string | null }, session: SessionLue): Promise<AdditifConsole> {
    await this.db
      .insert(additifSurcharge)
      .values({ codeE: code, statut: valeurs.statut, source: valeurs.source, note: valeurs.note, updatedBy: session.compteId, updatedAt: new Date() })
      .onConflictDoUpdate({ target: additifSurcharge.codeE, set: { statut: valeurs.statut, source: valeurs.source, note: valeurs.note, updatedBy: session.compteId, updatedAt: new Date() } });
    await this.journaliser(session.compteId, 'additif.surcharge', code, { statut: valeurs.statut, source: valeurs.source, note: valeurs.note });
    const ligne = (await this.additifs()).find((a) => a.code === code);
    if (!ligne) throw new ErreurMetier(404, 'introuvable', 'Additif introuvable.');
    return ligne;
  }

  /** Le journal, lecture seule, les 200 dernières lignes. */
  async journal(limite = 200) {
    const lignes = await this.db
      .select({ id: journalAdmin.id, action: journalAdmin.action, objet: journalAdmin.objet, detail: journalAdmin.detail, createdAt: journalAdmin.createdAt, email: compteAdmin.email })
      .from(journalAdmin)
      .leftJoin(compteAdmin, eq(compteAdmin.id, journalAdmin.compteId))
      .orderBy(desc(journalAdmin.createdAt))
      .limit(limite);
    return lignes.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }));
  }

  /** La seule voie d'écriture du journal d'administration (ajout seul). */
  private async journaliser(compteId: string | null, action: string, objet: string | null, detail: Record<string, unknown>): Promise<void> {
    await this.db.insert(journalAdmin).values({ compteId, action, objet, detail });
  }
}
