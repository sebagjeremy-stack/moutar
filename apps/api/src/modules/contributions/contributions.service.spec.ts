import { describe, expect, it } from 'vitest';
import type { Database } from '../../database/client';
import { baseSimulee, resume, valeurs, type Chaine } from '../../test/db-simulee';
import type { SessionLue } from '../admin/admin.service';
import type { ProduitsService } from '../produits/produits.service';
import { ContributionsService } from './contributions.service';
import { SignalementsService } from './signalements.service';

const PRODUIT = { id: 'p1', ean: '3017620422003', nom: 'Galettes', marque: 'Saint-Michel', imageUrl: null, ingredientsTexte: null, additifs: [], source: 'manuel' as const, luLe: '2026-10-20T10:00:00.000Z' };
const produits = { lireParEan: async () => PRODUIT } as unknown as ProduitsService;
const session: SessionLue = { sessionId: 's', compteId: 'compte-1', email: 'a@b.fr', nom: 'A' };
const T0 = new Date('2026-10-20T10:00:00Z');
const CONTRIB = { id: 'c1', produitId: 'p1', niveau: 3, statutPropose: 'cite' as const, sourceType: 'lbpc' as const, sourceTexte: 'Validé par le groupe', sourceDate: '2026-05-03', preuveUrl: null, auteurNom: 'Sarah', etat: 'proposee' as const, valideePar: null, valideeLe: null, motifRefus: null, createdAt: T0, updatedAt: T0, deletedAt: null };

function service(etatEnBase: 'proposee' | 'validee' | 'refusee' = 'proposee') {
  const ligne = { ...CONTRIB, etat: etatEnBase };
  const reponse = (chaine: Chaine): unknown => {
    const r = resume(chaine);
    if (r === 'select contribution') return [ligne];
    if (r === 'update contribution') return [{ ...ligne, etat: 'validee', valideeLe: T0, updatedAt: T0 }];
    if (r === 'select produit') return [{ id: 'p1', ean: PRODUIT.ean, nom: PRODUIT.nom, marque: PRODUIT.marque }];
    if (r === 'insert contribution') return [{ id: 'c-neuve' }];
    if (r === 'insert signalement') return [{ id: 's-neuf' }];
    if (r === 'select signalement') return [{ id: 's1', produitId: 'p1', niveau: 2, texte: 'faux', etat: 'ouvert', traiteLe: null, createdAt: T0 }];
    if (r === 'update signalement') return [{ id: 's1', produitId: 'p1', niveau: 2, texte: 'faux', etat: 'traite', traiteLe: T0, createdAt: T0 }];
    return [];
  };
  const { faux, db, tx } = baseSimulee(reponse);
  return { contributions: new ContributionsService(faux as unknown as Database, produits), signalements: new SignalementsService(faux as unknown as Database, produits), db, tx };
}

describe('ContributionsService.proposer', () => {
  it('écrit la proposition en texte brut, niveau 3, état proposee ; rend { id, etat }', async () => {
    const { contributions, db } = service();
    const r = await contributions.proposer('3017620422003', { statutPropose: 'cite', sourceType: 'lbpc', sourceTexte: '<b>Validé</b> le 3 mai', sourceDate: '2026-05-03', preuveUrl: 'https://facebook.com/x', auteurNom: '<i>Sarah</i>' });
    expect(r).toEqual({ id: 'c-neuve', etat: 'proposee' });
    expect(db.map(resume)).toEqual(['insert contribution']);
    expect(valeurs(db[0])).toEqual({ produitId: 'p1', niveau: 3, statutPropose: 'cite', sourceType: 'lbpc', sourceTexte: 'Validé le 3 mai', sourceDate: '2026-05-03', preuveUrl: 'https://facebook.com/x', auteurNom: 'Sarah', etat: 'proposee' });
    // Aucune donnée personnelle : ni e-mail, ni adresse IP.
    expect(Object.keys(valeurs(db[0]))).not.toEqual(expect.arrayContaining(['email', 'ip', 'adresse']));
  });
  it('un texte vide après nettoyage → 400, rien n’est écrit', async () => {
    const { contributions, db } = service();
    await expect(contributions.proposer('3017620422003', { statutPropose: 'cite', sourceType: 'lbpc', sourceTexte: '<br><br>', sourceDate: null, preuveUrl: null, auteurNom: null })).rejects.toMatchObject({ status: 400 });
    expect(db).toEqual([]);
  });
});

describe('ContributionsService.decider (transaction, verrou du produit, verdict de niveau 3, journal)', () => {
  it('valider : verrou, relecture, retrait de l’ancien verdict de la contribution, mise à jour, verdict écrit, journal contribution.validation — dans cet ordre, dans la transaction', async () => {
    const { contributions, db, tx } = service();
    const r = await contributions.decider('c1', { etat: 'validee', motifRefus: null }, session);
    expect(db.map(resume)).toEqual(['select contribution', 'select produit']);
    expect(tx.map(resume)).toEqual(['execute', 'select contribution', 'update verdict', 'update contribution', 'insert verdict', 'insert journal_admin']);
    const verrou = tx[0][0].args[0] as { queryChunks: unknown[] };
    expect(JSON.stringify(verrou.queryChunks)).toContain('pg_advisory_xact_lock(hashtext(');
    expect(JSON.stringify(verrou.queryChunks)).toContain('produit:p1');
    expect(valeurs(tx[2])).toHaveProperty('deletedAt');
    expect(valeurs(tx[3])).toMatchObject({ etat: 'validee', valideePar: 'compte-1', motifRefus: null });
    expect(valeurs(tx[4])).toMatchObject({ produitId: 'p1', niveau: 3, statut: 'cite', source: 'Les Bons Plans Cachères', mention: 'communauté · LBPC', detail: { contributionId: 'c1', validePar: 'console' } });
    expect(valeurs(tx[5])).toMatchObject({ compteId: 'compte-1', action: 'contribution.validation', objet: 'c1', detail: { produitId: 'p1', statutPropose: 'cite', etatAvant: 'proposee' } });
    expect(r).toMatchObject({ id: 'c1', etat: 'validee', produit: { ean: '3017620422003', nom: 'Galettes' }, valideeLe: '2026-10-20T10:00:00.000Z' });
  });
  it('refuser une contribution validée : le verdict est retiré (doux), aucun verdict écrit, journal contribution.refus avec le motif', async () => {
    const { contributions, tx } = service('validee');
    await contributions.decider('c1', { etat: 'refusee', motifRefus: 'Capture illisible' }, session);
    expect(tx.map(resume)).toEqual(['execute', 'select contribution', 'update verdict', 'update contribution', 'insert journal_admin']);
    expect(valeurs(tx[3])).toMatchObject({ etat: 'refusee', motifRefus: 'Capture illisible', valideeLe: null });
    expect(valeurs(tx[4])).toMatchObject({ action: 'contribution.refus', detail: { etatAvant: 'validee', motifRefus: 'Capture illisible' } });
  });
  it('un verdict douteux s’écrit non_verifie, jamais non_casher', async () => {
    const { faux, tx } = baseSimulee((c) => (resume(c) === 'select contribution' ? [{ ...CONTRIB, statutPropose: 'douteux' }] : resume(c) === 'update contribution' ? [{ ...CONTRIB, statutPropose: 'douteux', etat: 'validee', valideeLe: T0 }] : []));
    await new ContributionsService(faux as unknown as Database, produits).decider('c1', { etat: 'validee', motifRefus: null }, session);
    expect(valeurs(tx.find((c) => resume(c) === 'insert verdict')!)).toMatchObject({ statut: 'non_verifie', mention: 'signalé douteux' });
  });
  it('le même état → 409 etat_identique, rien n’est écrit après la relecture sous verrou', async () => {
    const { contributions, tx } = service('validee');
    await expect(contributions.decider('c1', { etat: 'validee', motifRefus: null }, session)).rejects.toMatchObject({ status: 409, response: { code: 'etat_identique' } });
    expect(tx.map(resume)).toEqual(['execute', 'select contribution']);
  });
  it('contribution inconnue → 404', async () => {
    const { faux } = baseSimulee(() => []);
    await expect(new ContributionsService(faux as unknown as Database, produits).decider('inconnue', { etat: 'validee', motifRefus: null }, session)).rejects.toMatchObject({ status: 404, response: { code: 'contribution_inconnue' } });
  });
});

describe('SignalementsService', () => {
  it('signaler : texte brut, état ouvert, rien d’autre ; traiter : transaction + journal signalement.traitement ; déjà traité → 409', async () => {
    const { signalements, db, tx } = service();
    expect(await signalements.signaler('3017620422003', { niveau: 2, texte: '<b>La marque</b> n’est plus citée' })).toEqual({ id: 's-neuf', etat: 'ouvert' });
    expect(valeurs(db[0])).toEqual({ produitId: 'p1', niveau: 2, texte: 'La marque n’est plus citée', etat: 'ouvert' });
    const r = await signalements.traiter('s1', session);
    expect(tx.map(resume)).toEqual(['select signalement', 'update signalement', 'insert journal_admin']);
    expect(valeurs(tx[2])).toMatchObject({ action: 'signalement.traitement', objet: 's1', detail: { produitId: 'p1', niveau: 2 } });
    expect(r).toMatchObject({ id: 's1', etat: 'traite', produit: { nom: 'Galettes' } });
    const deja = baseSimulee((c) => (resume(c) === 'select signalement' ? [{ id: 's1', produitId: 'p1', niveau: 2, texte: 'x', etat: 'traite', traiteLe: T0, createdAt: T0 }] : []));
    await expect(new SignalementsService(deja.faux as unknown as Database, produits).traiter('s1', session)).rejects.toMatchObject({ status: 409 });
  });
});
