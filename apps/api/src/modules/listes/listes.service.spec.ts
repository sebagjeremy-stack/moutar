import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { SousLigneListe } from '@moutar/shared-types';
import type { Database } from '../../database/client';
import type { SessionLue } from '../admin/admin.service';
import { ListesService, instantDuJour, normesLigne, verifierLigne, type ImportListe } from './listes.service';

/*
 * Le service se teste SANS base : un faux exécuteur enregistre chaque chaîne Drizzle (`insert(table).values(...).returning()`)
 * et répond par une valeur choisie selon la table. La transaction reçoit son propre enregistreur : on vérifie que tout
 * l'import passe par elle, et dans l'ordre (désactivation de l'ancienne, liste, lignes, journal).
 */
interface Appel {
  methode: string;
  args: unknown[];
}
type Chaine = Appel[];

function nomTable(chaine: Chaine): string {
  const a = chaine.find((c) => c.methode === 'insert' || c.methode === 'update' || c.methode === 'from');
  return a ? getTableName(a.args[0] as Parameters<typeof getTableName>[0]) : '?';
}

function enregistreur(reponse: (chaine: Chaine) => unknown) {
  const chaines: Chaine[] = [];
  const nouvelle = (): unknown => {
    const chaine: Chaine = [];
    chaines.push(chaine);
    const proxy: unknown = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(reponse(chaine));
          return (...args: unknown[]) => {
            chaine.push({ methode: String(prop), args });
            return proxy;
          };
        },
      },
    );
    return proxy;
  };
  const executeur = {
    insert: (...args: unknown[]) => (nouvelle() as { insert: (...a: unknown[]) => unknown }).insert(...args),
    update: (...args: unknown[]) => (nouvelle() as { update: (...a: unknown[]) => unknown }).update(...args),
    select: (...args: unknown[]) => (nouvelle() as { select: (...a: unknown[]) => unknown }).select(...args),
  };
  return { chaines, executeur };
}

const LISTE_DB = { id: 'liste-neuve', code: 'consistoire_paris', titre: 'Consistoire 2025-2026', publieLe: '2025-07-01', valableJusquAu: '2026-07-31', importeLe: new Date('2026-10-20T10:00:00Z'), fichierNom: 'liste.pdf', noteSource: null, active: true, deletedAt: null };

function reponseParDefaut(chaine: Chaine): unknown {
  const table = nomTable(chaine);
  if (chaine[0]?.methode === 'insert' && table === 'liste_officielle') return [LISTE_DB];
  if (chaine[0]?.methode === 'select' && table === 'liste_officielle') return [{ liste: LISTE_DB, nombre: 2 }];
  if (chaine[0]?.methode === 'select' && table === 'ligne_liste') return [{ max: 4 }];
  return [];
}

function serviceSimule(reponse = reponseParDefaut) {
  const db = enregistreur(reponse);
  const tx = enregistreur(reponse);
  const faux = { ...db.executeur, transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx.executeur) };
  return { service: new ListesService(faux as unknown as Database), db: db.chaines, tx: tx.chaines };
}

const session: SessionLue = { sessionId: 's', compteId: 'compte-1', email: 'a@b.fr', nom: 'A' };
const valeurs = (chaine: Chaine): Record<string, unknown> => chaine.find((c) => c.methode === 'values' || c.methode === 'set')!.args[0] as Record<string, unknown>;

describe('ListesService.importer', () => {
  const importation: ImportListe = {
    code: 'consistoire_paris',
    titre: 'Consistoire 2025-2026',
    publieLe: '2025-07-01',
    valableJusquAu: '2026-07-31',
    fichierNom: 'liste.pdf',
    noteSource: null,
    lignes: [
      { rubrique: 'BISCUITS SECS', marque: 'Saint-Michel', produitLibelle: null, mention: 'lait_non_surveille', touteMarque: false, rubriqueReservee: false, ordre: 0 },
      { rubrique: 'YAOURTS', marque: null, produitLibelle: null, mention: null, touteMarque: true, rubriqueReservee: false, ordre: 1 },
    ],
  };

  it('tout passe par UNE transaction : désactiver l’ancienne, créer la liste, ses lignes, le journal — dans cet ordre', async () => {
    const { service, db, tx } = serviceSimule();
    const liste = await service.importer(importation, session);
    expect(db.filter((c) => c[0].methode !== 'select')).toEqual([]);
    expect(tx.map((c) => `${c[0].methode} ${nomTable(c)}`)).toEqual(['update liste_officielle', 'insert liste_officielle', 'insert ligne_liste', 'insert journal_admin']);
    expect(valeurs(tx[0])).toEqual({ active: false });
    expect(tx[0].some((c) => c.methode === 'where')).toBe(true);
    expect(valeurs(tx[1])).toMatchObject({ code: 'consistoire_paris', titre: 'Consistoire 2025-2026', active: true, valableJusquAu: '2026-07-31' });
    expect(liste).toMatchObject({ id: 'liste-neuve', nombreLignes: 2, publieLe: '2025-07-01', importeLe: '2026-10-20T10:00:00.000Z' });
  });
  it('les lignes portent leurs colonnes normalisées et leur ordre', async () => {
    const { service, tx } = serviceSimule();
    await service.importer(importation, session);
    const lignes = valeurs(tx[2]) as unknown as Array<Record<string, unknown>>;
    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toMatchObject({ listeId: 'liste-neuve', marque: 'Saint-Michel', marqueNorm: 'saint michel', rubriqueNorm: 'biscuits secs', ordre: 0, mention: 'lait_non_surveille' });
    expect(lignes[1]).toMatchObject({ touteMarque: true, marqueNorm: '', ordre: 1 });
  });
  it('le journal note liste.import avec le code, le titre, le nombre de lignes et le fichier', async () => {
    const { service, tx } = serviceSimule();
    await service.importer(importation, session);
    expect(valeurs(tx[3])).toMatchObject({ compteId: 'compte-1', action: 'liste.import', objet: 'liste-neuve', detail: { code: 'consistoire_paris', nombreLignes: 2, fichierNom: 'liste.pdf' } });
  });
  it('aucune ligne → 400 liste_vide, rien n’est écrit', async () => {
    const { service, tx } = serviceSimule();
    await expect(service.importer({ ...importation, lignes: [] }, session)).rejects.toMatchObject({ status: 400 });
    expect(tx).toEqual([]);
  });
  it('une ligne incohérente → 400 ligne_invalide qui dit laquelle, rien n’est écrit', async () => {
    const { service, tx } = serviceSimule();
    const mauvaise = { ...importation, lignes: [importation.lignes[0], { ...importation.lignes[1], marque: 'X' }] };
    await expect(service.importer(mauvaise, session)).rejects.toMatchObject({ status: 400, response: { code: 'ligne_invalide', index: 1 } });
    expect(tx).toEqual([]);
  });
  it('plus de 500 lignes partent par lots', async () => {
    const { service, tx } = serviceSimule();
    const lignes = Array.from({ length: 1201 }, (_, i) => ({ rubrique: 'R', marque: `M${i}`, produitLibelle: null, mention: null, touteMarque: false, rubriqueReservee: false, ordre: i }));
    await service.importer({ ...importation, lignes }, session);
    expect(tx.filter((c) => nomTable(c) === 'ligne_liste')).toHaveLength(3);
  });
});

describe('ListesService.modifier', () => {
  it('activer une liste désactive d’abord l’autre du même code, dans la transaction, puis journalise', async () => {
    const { service, tx } = serviceSimule();
    await service.modifier('liste-neuve', { active: true, titre: 'Nouveau titre' }, session);
    expect(tx.map((c) => `${c[0].methode} ${nomTable(c)}`)).toEqual(['update liste_officielle', 'update liste_officielle', 'insert journal_admin']);
    expect(valeurs(tx[0])).toEqual({ active: false });
    expect(valeurs(tx[1])).toEqual({ active: true, titre: 'Nouveau titre' });
    expect(valeurs(tx[2])).toMatchObject({ action: 'liste.modification', objet: 'liste-neuve', detail: { code: 'consistoire_paris', active: true } });
  });
  it('désactiver ne touche que la liste visée', async () => {
    const { service, tx } = serviceSimule();
    await service.modifier('liste-neuve', { active: false }, session);
    expect(tx.map((c) => `${c[0].methode} ${nomTable(c)}`)).toEqual(['update liste_officielle', 'insert journal_admin']);
  });
  it('liste inconnue → 404', async () => {
    const { service } = serviceSimule((c) => (nomTable(c) === 'liste_officielle' ? [] : reponseParDefaut(c)));
    await expect(service.modifier('absente', { active: false }, session)).rejects.toMatchObject({ status: 404 });
  });
});

describe('ListesService.enregistrerVerdictsNiveau2', () => {
  const sousLigne: SousLigneListe = {
    listeId: 'liste-neuve',
    code: 'consistoire_paris',
    source: 'Consistoire 2025-2026',
    publieLe: '2025-07-01',
    valableJusquAu: '2026-07-31',
    statut: 'cite',
    confiance: 'forte',
    mention: 'lait non surveillé',
    detail: 'd',
    ligne: { id: 'l1', rubrique: 'B', marque: 'Lu', produitLibelle: null },
  };
  it('écrit un verdict neuf, puis rien tant que l’empreinte ne change pas ; « périmé » s’écrit comme « cite »', async () => {
    const premier = serviceSimule((c) => (nomTable(c) === 'verdict' ? [] : reponseParDefaut(c)));
    await premier.service.enregistrerVerdictsNiveau2('p1', [sousLigne]);
    const inserts = premier.db.filter((c) => c[0].methode === 'insert');
    expect(inserts).toHaveLength(1);
    const ecrit = valeurs(inserts[0]);
    expect(ecrit).toMatchObject({ produitId: 'p1', niveau: 2, statut: 'cite', source: 'Consistoire 2025-2026', mention: 'lait non surveillé' });
    expect((ecrit['valableJusquAu'] as Date).toISOString()).toBe('2026-07-31T12:00:00.000Z');

    const second = serviceSimule((c) => (nomTable(c) === 'verdict' && c[0].methode === 'select' ? [{ detail: ecrit['detail'] }] : nomTable(c) === 'verdict' ? [] : reponseParDefaut(c)));
    await second.service.enregistrerVerdictsNiveau2('p1', [{ ...sousLigne, statut: 'perime' }]);
    expect(second.db.filter((c) => c[0].methode === 'insert')).toHaveLength(0);

    await second.service.enregistrerVerdictsNiveau2('p1', [{ ...sousLigne, statut: 'non_cite', ligne: null, confiance: null }]);
    expect(second.db.filter((c) => c[0].methode === 'insert')).toHaveLength(1);
    expect(valeurs(second.db.filter((c) => c[0].methode === 'insert')[0])).toMatchObject({ statut: 'non_cite' });
  });
});

describe('briques pures du service', () => {
  it('verifierLigne', () => {
    expect(verifierLigne({ rubrique: 'B', marque: 'Lu', produitLibelle: null, touteMarque: false, rubriqueReservee: false })).toBeNull();
    expect(verifierLigne({ rubrique: 'B', marque: null, produitLibelle: null, touteMarque: true, rubriqueReservee: false })).toBeNull();
    expect(verifierLigne({ rubrique: ' ', marque: 'Lu', produitLibelle: null, touteMarque: false, rubriqueReservee: false })).toMatch(/rubrique/);
    expect(verifierLigne({ rubrique: 'B', marque: 'Lu', produitLibelle: null, touteMarque: true, rubriqueReservee: false })).toMatch(/toute marque/);
    expect(verifierLigne({ rubrique: 'VINS', marque: null, produitLibelle: null, touteMarque: true, rubriqueReservee: true })).toMatch(/réservée/);
    expect(verifierLigne({ rubrique: 'B', marque: null, produitLibelle: null, touteMarque: false, rubriqueReservee: false })).toMatch(/nomme/);
  });
  it('normesLigne et instantDuJour', () => {
    expect(normesLigne({ rubrique: 'PÂTES À TARTINER', marque: 'Côte d’Or', produitLibelle: null })).toEqual({ rubriqueNorm: 'pates a tartiner', marqueNorm: 'cote d or', produitNorm: '' });
    expect(instantDuJour('2026-11-01')?.toISOString()).toBe('2026-11-01T12:00:00.000Z');
    expect(instantDuJour(null)).toBeNull();
    expect(instantDuJour('demain')).toBeNull();
  });
});
