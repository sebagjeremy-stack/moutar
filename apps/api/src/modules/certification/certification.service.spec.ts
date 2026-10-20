import { describe, expect, it } from 'vitest';
import type { ResultatLectureLogo } from '@moutar/shared-types';
import { PropositionsEnAttente } from '../../common/auth/propositions-en-attente';
import type { Database } from '../../database/client';
import { baseSimulee, resume, valeurs, type Chaine } from '../../test/db-simulee';
import type { MoteurIa } from '../ia/moteur-ia';
import type { ProduitsService } from '../produits/produits.service';
import { schemaValidation } from './certification.controller';
import { CertificationService } from './certification.service';

const EAN = '3017620422003';
const PRODUIT = { id: 'p1', ean: EAN, nom: 'Galettes', marque: 'Saint-Michel', imageUrl: null, ingredientsTexte: null, additifs: [], source: 'manuel' as const, luLe: '2026-10-20T10:00:00.000Z' };
const produits = { lireParEan: async () => PRODUIT } as unknown as ProduitsService;
const T0 = new Date('2026-10-20T10:00:00Z');
const image = { octets: Buffer.from('png'), type: 'image/png' as const };

/** Un moteur simulé : le modèle « lit » un U dans un cercle avec PARVE. */
const moteur = {
  lireImage: async () => ({ valeur: { candidats: [{ texteLu: 'U', forme: 'lettre U dans un cercle', confiance: 1 }], mentions: ['PARVE'], autresTextes: [] }, modele: 'Qwen', jetonsEntree: 1, jetonsSortie: 1 }),
} as unknown as MoteurIa;

function service(options: { produitVivant?: boolean } = {}) {
  const reponse = (chaine: Chaine): unknown => {
    const r = resume(chaine);
    if (r === 'select certificateur_surcharge') return [];
    if (r === 'select produit') return options.produitVivant === false ? [] : [{ id: 'p1' }];
    if (r === 'insert verdict') return [{ id: 'v1', produitId: 'p1', niveau: 1, statut: 'cite', source: 'Orthodox Union (OU)', mention: 'parvé', publieLe: T0, createdAt: T0, deletedAt: null, detail: valeurs(chaine)['detail'] }];
    return [];
  };
  const { faux, db, tx } = baseSimulee(reponse);
  const propositions = new PropositionsEnAttente();
  return { s: new CertificationService(faux as unknown as Database, moteur, produits, propositions), db, tx, propositions };
}

async function erreur(p: Promise<unknown>): Promise<{ status: number; code: string }> {
  try {
    await p;
  } catch (e) {
    const err = e as { status: number; response: { code: string } };
    return { status: err.status, code: err.response.code };
  }
  throw new Error('aucune erreur');
}

describe('CertificationService : lecture → jeton → validation sous verrou', () => {
  it('la lecture rend les propositions ET un jeton ; sans proposition, pas de jeton', async () => {
    const { s, propositions } = service();
    const r = await s.lireLogo(image, EAN);
    expect(r.propositions.map((p) => p.code)).toEqual(['ou']);
    expect(r.jeton).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(propositions.taille).toBe(1);
    const sans = new CertificationService({ select: () => ({ from: () => ({ where: async () => [] }) }) } as unknown as Database, { lireImage: async () => ({ valeur: { candidats: [], mentions: [], autresTextes: [] }, modele: 'Q', jetonsEntree: null, jetonsSortie: null }) } as unknown as MoteurIa, produits, propositions);
    expect((await sans.lireLogo(image, EAN)).jeton).toBeNull();
  });

  it('valider : verrou du produit, fiche relue, ancienne retirée, verdict écrit — dans cet ordre, dans la transaction ; texte lu en texte brut borné à 200', async () => {
    const { s, tx } = service();
    const { jeton } = (await s.lireLogo(image, EAN)) as ResultatLectureLogo & { jeton: string };
    const c = await s.valider(EAN, { jeton, code: 'ou', mentions: ['parve', 'parve'], texteLu: `<b>U</b> ${'x'.repeat(300)}` });
    expect(tx.map(resume)).toEqual(['execute', 'select produit', 'update verdict', 'insert verdict']);
    expect(JSON.stringify((tx[0][0].args[0] as { queryChunks: unknown[] }).queryChunks)).toContain('pg_advisory_xact_lock(hashtext(');
    expect(valeurs(tx[2])).toHaveProperty('deletedAt');
    const ecrit = valeurs(tx[3]);
    expect(ecrit).toMatchObject({ produitId: 'p1', niveau: 1, statut: 'cite', source: 'Orthodox Union (OU)', mention: 'parvé', valableJusquAu: null });
    const detail = ecrit['detail'] as { texteLu: string; mentions: string[] };
    expect(detail.mentions).toEqual(['parve']);
    expect(detail.texteLu.startsWith('U x')).toBe(true);
    expect(detail.texteLu).toHaveLength(200);
    expect(c).toMatchObject({ code: 'ou', nomCourt: 'OU', mentions: ['parve'], certificateurActif: true });
  });

  it('le jeton se consomme : la seconde validation → 400 proposition_inconnue ; un EAN différent, un code non proposé, un jeton inconnu aussi', async () => {
    const { s, tx } = service();
    const { jeton } = (await s.lireLogo(image, EAN)) as ResultatLectureLogo & { jeton: string };
    expect(await erreur(s.valider('3017620422004', { jeton, code: 'ou', mentions: [], texteLu: null }))).toEqual({ status: 400, code: 'proposition_inconnue' });
    expect(await erreur(s.valider(EAN, { jeton, code: 'klbd', mentions: [], texteLu: null }))).toEqual({ status: 400, code: 'proposition_inconnue' });
    expect(await erreur(s.valider(EAN, { jeton: 'jeton-inconnu-xxxx', code: 'ou', mentions: [], texteLu: null }))).toEqual({ status: 400, code: 'proposition_inconnue' });
    expect(tx).toEqual([]);
    await s.valider(EAN, { jeton, code: 'ou', mentions: [], texteLu: null });
    expect(await erreur(s.valider(EAN, { jeton, code: 'ou', mentions: [], texteLu: null }))).toEqual({ status: 400, code: 'proposition_inconnue' });
    expect(tx.filter((c) => resume(c) === 'insert verdict')).toHaveLength(1);
  });

  it('parvé + halavi → 400 mentions_contradictoires, le jeton n’est PAS consommé, rien n’est écrit', async () => {
    const { s, tx, propositions } = service();
    const { jeton } = (await s.lireLogo(image, EAN)) as ResultatLectureLogo & { jeton: string };
    expect(await erreur(s.valider(EAN, { jeton, code: 'ou', mentions: ['parve', 'halavi'], texteLu: null }))).toEqual({ status: 400, code: 'mentions_contradictoires' });
    expect(tx).toEqual([]);
    expect(propositions.taille).toBe(1);
  });

  it('un produit retiré entre la lecture et la validation → 404 sous le verrou, rien n’est écrit', async () => {
    const { s, tx } = service({ produitVivant: false });
    const { jeton } = (await s.lireLogo(image, EAN)) as ResultatLectureLogo & { jeton: string };
    expect(await erreur(s.valider(EAN, { jeton, code: 'ou', mentions: [], texteLu: null }))).toEqual({ status: 404, code: 'produit_inconnu' });
    expect(tx.map(resume)).toEqual(['execute', 'select produit']);
  });

  it('le schéma de la route exige le jeton', () => {
    expect(() => schemaValidation.parse({ code: 'ou' })).toThrow();
    expect(schemaValidation.parse({ jeton: 'abcdefghijkl', code: 'ou', texteLu: '' })).toMatchObject({ jeton: 'abcdefghijkl', mentions: [], texteLu: null });
  });
});
