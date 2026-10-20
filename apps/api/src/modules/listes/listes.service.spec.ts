import { describe, expect, it } from 'vitest';
import type { SousLigneListe } from '@moutar/shared-types';
import type { Database } from '../../database/client';
import { baseSimulee, nomTable, resume, valeurs, type Chaine } from '../../test/db-simulee';
import type { SessionLue } from '../admin/admin.service';
import { ListesService, estViolationUnicite, instantDuJour, nomFichierSur, normesLigne, reserveeEffective, verifierLigne, type ImportListe } from './listes.service';

const LISTE_DB = { id: 'liste-neuve', code: 'consistoire_paris', titre: 'Consistoire 2025-2026', publieLe: '2025-07-01', valableJusquAu: '2026-07-31', importeLe: new Date('2026-10-20T10:00:00Z'), fichierNom: 'liste.pdf', noteSource: null, active: true, deletedAt: null };

function reponseParDefaut(chaine: Chaine): unknown {
  const table = nomTable(chaine);
  if (chaine[0]?.methode === 'insert' && table === 'liste_officielle') return [LISTE_DB];
  if (chaine[0]?.methode === 'select' && table === 'liste_officielle') return [{ liste: LISTE_DB, nombre: 2 }];
  if (chaine[0]?.methode === 'select' && table === 'ligne_liste') return [{ max: 4 }];
  return [];
}

/* Le service se teste SANS base (`test/db-simulee.ts`) : la transaction a son propre enregistreur, on vérifie l'ordre des écritures. */
function serviceSimule(reponse = reponseParDefaut, reponseTx = reponse) {
  const { faux, db, tx } = baseSimulee(reponse, reponseTx);
  return { service: new ListesService(faux as unknown as Database), db, tx };
}

const session: SessionLue = { sessionId: 's', compteId: 'compte-1', email: 'a@b.fr', nom: 'A' };

/** Le texte SQL d'une chaîne `execute(sql…)` (le verrou consultatif). */
const sqlDe = (chaine: Chaine): string => JSON.stringify((chaine[0].args[0] as { queryChunks: unknown[] }).queryChunks);

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

  it('tout passe par UNE transaction : verrou de la liste, désactiver l’ancienne, créer la liste, ses lignes, le journal — dans cet ordre', async () => {
    const { service, db, tx } = serviceSimule();
    const liste = await service.importer(importation, session);
    expect(db.filter((c) => c[0].methode !== 'select')).toEqual([]);
    expect(tx.map(resume)).toEqual(['execute', 'update liste_officielle', 'insert liste_officielle', 'insert ligne_liste', 'insert journal_admin']);
    expect(sqlDe(tx[0])).toContain('pg_advisory_xact_lock(hashtext(');
    expect(sqlDe(tx[0])).toContain('liste:consistoire_paris');
    expect(valeurs(tx[1])).toEqual({ active: false });
    expect(tx[1].some((c) => c.methode === 'where')).toBe(true);
    expect(valeurs(tx[2])).toMatchObject({ code: 'consistoire_paris', titre: 'Consistoire 2025-2026', active: true, valableJusquAu: '2026-07-31' });
    expect(liste).toMatchObject({ id: 'liste-neuve', nombreLignes: 2, publieLe: '2025-07-01', importeLe: '2026-10-20T10:00:00.000Z' });
  });
  it('les lignes portent leurs colonnes normalisées et leur ordre', async () => {
    const { service, tx } = serviceSimule();
    await service.importer(importation, session);
    const lignes = valeurs(tx[3]) as unknown as Array<Record<string, unknown>>;
    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toMatchObject({ listeId: 'liste-neuve', marque: 'Saint-Michel', marqueNorm: 'saint michel', rubriqueNorm: 'biscuits secs', ordre: 0, mention: 'lait_non_surveille' });
    expect(lignes[1]).toMatchObject({ touteMarque: true, marqueNorm: '', ordre: 1 });
  });
  it('le journal note liste.import avec le code, le titre, le nombre de lignes et le fichier', async () => {
    const { service, tx } = serviceSimule();
    await service.importer(importation, session);
    expect(valeurs(tx[4])).toMatchObject({ compteId: 'compte-1', action: 'liste.import', objet: 'liste-neuve', detail: { code: 'consistoire_paris', nombreLignes: 2, fichierNom: 'liste.pdf' } });
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
  it('« VINS » en toute marque avec rubriqueReservee: false → 400 ligne_invalide : le drapeau est recalculé AVANT la vérification', async () => {
    const { service, tx } = serviceSimule();
    const vins = { ...importation, lignes: [{ rubrique: 'VINS', marque: null, produitLibelle: null, mention: null, touteMarque: true, rubriqueReservee: false, ordre: 0 }] };
    await expect(service.importer(vins, session)).rejects.toMatchObject({ status: 400, response: { code: 'ligne_invalide', index: 0 } });
    expect(tx).toEqual([]);
  });
  it('une marque sous « CHARCUTERIE » s’écrit réservée même si l’écran a décoché la case', async () => {
    const { service, tx } = serviceSimule();
    await service.importer({ ...importation, lignes: [{ rubrique: 'CHARCUTERIE', marque: 'Zelbo', produitLibelle: null, mention: null, touteMarque: false, rubriqueReservee: false, ordre: 0 }] }, session);
    const [ligne] = valeurs(tx[3]) as unknown as Array<Record<string, unknown>>;
    expect(ligne).toMatchObject({ marque: 'Zelbo', rubriqueReservee: true });
  });
  it('le nom du fichier est borné (300) et sans caractère de contrôle', async () => {
    const { service, tx } = serviceSimule();
    await service.importer({ ...importation, fichierNom: `liste\u0000\u001b[31m${'a'.repeat(400)}.pdf` }, session);
    const nom = valeurs(tx[2])['fichierNom'] as string;
    expect(nom.length).toBe(300);
    expect(nom.startsWith('liste [31maaa')).toBe(true);
  });
  it('plus de 500 lignes partent par lots', async () => {
    const { service, tx } = serviceSimule();
    const lignes = Array.from({ length: 1201 }, (_, i) => ({ rubrique: 'R', marque: `M${i}`, produitLibelle: null, mention: null, touteMarque: false, rubriqueReservee: false, ordre: i }));
    await service.importer({ ...importation, lignes }, session);
    expect(tx.filter((c) => nomTable(c) === 'ligne_liste')).toHaveLength(3);
  });
  it('une violation d’unicité (23505) dans la transaction → 409 import_concurrent, jamais une 500', async () => {
    const unicite = Object.assign(new Error('duplicate key value violates unique constraint "liste_officielle_active_par_code_idx"'), { code: '23505' });
    const { service } = serviceSimule(reponseParDefaut, (c) => {
      if (c[0]?.methode === 'insert' && nomTable(c) === 'liste_officielle') throw unicite;
      return reponseParDefaut(c);
    });
    await expect(service.importer(importation, session)).rejects.toMatchObject({ status: 409, response: { code: 'import_concurrent' } });
  });
  it('une autre erreur de la base remonte telle quelle', async () => {
    const panne = new Error('connexion perdue');
    const { service } = serviceSimule(reponseParDefaut, () => {
      throw panne;
    });
    await expect(service.importer(importation, session)).rejects.toBe(panne);
  });
});

describe('ListesService.modifier', () => {
  it('activer une liste prend le verrou de la liste, désactive d’abord l’autre du même code, dans la transaction, puis journalise', async () => {
    const { service, tx } = serviceSimule();
    await service.modifier('liste-neuve', { active: true, titre: 'Nouveau titre' }, session);
    expect(tx.map(resume)).toEqual(['execute', 'update liste_officielle', 'update liste_officielle', 'insert journal_admin']);
    expect(sqlDe(tx[0])).toContain('liste:consistoire_paris');
    expect(valeurs(tx[1])).toEqual({ active: false });
    expect(valeurs(tx[2])).toEqual({ active: true, titre: 'Nouveau titre' });
    expect(valeurs(tx[3])).toMatchObject({ action: 'liste.modification', objet: 'liste-neuve', detail: { code: 'consistoire_paris', active: true } });
  });
  it('désactiver ne touche que la liste visée, sans verrou', async () => {
    const { service, tx } = serviceSimule();
    await service.modifier('liste-neuve', { active: false }, session);
    expect(tx.map(resume)).toEqual(['update liste_officielle', 'insert journal_admin']);
  });
  it('liste inconnue → 404', async () => {
    const { service } = serviceSimule((c) => (nomTable(c) === 'liste_officielle' ? [] : reponseParDefaut(c)));
    await expect(service.modifier('absente', { active: false }, session)).rejects.toMatchObject({ status: 404 });
  });
  it('activer sous un 23505 (une autre activation vient d’aboutir) → 409 import_concurrent', async () => {
    const { service } = serviceSimule(reponseParDefaut, (c) => {
      if (c[0]?.methode === 'update') throw Object.assign(new Error('duplicate'), { cause: { code: '23505' } });
      return reponseParDefaut(c);
    });
    await expect(service.modifier('liste-neuve', { active: true }, session)).rejects.toMatchObject({ status: 409, response: { code: 'import_concurrent' } });
  });
});

describe('ListesService.modifierLigne', () => {
  const LIGNE_DB = { id: 'l1', listeId: 'liste-neuve', rubrique: 'BISCUITS', marque: 'Lu', produitLibelle: null, mention: null, touteMarque: false, rubriqueReservee: false, ordre: 0, rubriqueNorm: 'biscuits', marqueNorm: 'lu', produitNorm: '', createdAt: new Date(), updatedAt: new Date(), deletedAt: null };
  const avecLigne = (c: Chaine): unknown => {
    if (nomTable(c) === 'ligne_liste' && c[0]?.methode === 'select') return [LIGNE_DB];
    if (nomTable(c) === 'ligne_liste' && c[0]?.methode === 'update') return [{ ...LIGNE_DB, ...(valeurs(c) as Record<string, unknown>) }];
    return reponseParDefaut(c);
  };
  it('renommer la rubrique en « VINS » rend la ligne réservée, même sans le drapeau', async () => {
    const { service, db } = serviceSimule(avecLigne);
    const l = await service.modifierLigne('liste-neuve', 'l1', { rubrique: 'VINS' }, session);
    expect(l.rubriqueReservee).toBe(true);
    expect(valeurs(db.find((c) => c[0].methode === 'update')!)).toMatchObject({ rubrique: 'VINS', rubriqueReservee: true, rubriqueNorm: 'vins' });
  });
  it('… et même avec rubriqueReservee: false envoyé ; « toute marque » y est alors refusé (400)', async () => {
    const { service } = serviceSimule(avecLigne);
    expect((await service.modifierLigne('liste-neuve', 'l1', { rubrique: 'Vins fins', rubriqueReservee: false }, session)).rubriqueReservee).toBe(true);
    await expect(service.modifierLigne('liste-neuve', 'l1', { rubrique: 'VINS', marque: null, touteMarque: true }, session)).rejects.toMatchObject({ status: 400, response: { code: 'ligne_invalide' } });
  });
  it('renommer vers une rubrique ordinaire oublie le drapeau d’avant ; le cocher le garde', async () => {
    const reservee = (c: Chaine): unknown => (nomTable(c) === 'ligne_liste' && c[0]?.methode === 'select' ? [{ ...LIGNE_DB, rubrique: 'VINS', rubriqueReservee: true }] : avecLigne(c));
    const { service } = serviceSimule(reservee);
    expect((await service.modifierLigne('liste-neuve', 'l1', { rubrique: 'BISCUITS' }, session)).rubriqueReservee).toBe(false);
    expect((await service.modifierLigne('liste-neuve', 'l1', { rubrique: 'BISCUITS', rubriqueReservee: true }, session)).rubriqueReservee).toBe(true);
  });
});

describe('ListesService.lignes', () => {
  const ligneDb = (i: number) => ({ id: `l${i}`, listeId: 'liste-neuve', rubrique: 'R', marque: `M${i}`, produitLibelle: null, mention: null, touteMarque: false, rubriqueReservee: false, ordre: i });
  it('sous la limite : compte = lignes servies, pas de second compte, tronque: false', async () => {
    const { service, db } = serviceSimule((c) => (nomTable(c) === 'ligne_liste' ? [ligneDb(0), ligneDb(1)] : reponseParDefaut(c)));
    const r = await service.lignes('liste-neuve', null, 5000);
    expect(r).toMatchObject({ compte: 2, tronque: false });
    expect(db.filter((c) => nomTable(c) === 'ligne_liste')).toHaveLength(1);
  });
  it('à la limite : le compte RÉEL vient d’un COUNT en base, tronque: true au-delà', async () => {
    let appels = 0;
    const { service } = serviceSimule((c) => {
      if (nomTable(c) !== 'ligne_liste') return reponseParDefaut(c);
      appels++;
      return appels === 1 ? [ligneDb(0), ligneDb(1), ligneDb(2)] : [{ compte: 7 }];
    });
    const r = await service.lignes('liste-neuve', 'm', 3);
    expect(r).toMatchObject({ compte: 7, tronque: true });
    expect(r.lignes).toHaveLength(3);
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
  it('reserveeEffective : le drapeau reçu OU la rubrique', () => {
    expect(reserveeEffective({ rubrique: 'VINS', rubriqueReservee: false })).toBe(true);
    expect(reserveeEffective({ rubrique: 'BISCUITS', rubriqueReservee: true })).toBe(true);
    expect(reserveeEffective({ rubrique: 'BISCUITS', rubriqueReservee: false })).toBe(false);
  });
  it('nomFichierSur et estViolationUnicite', () => {
    expect(nomFichierSur('  liste\n2025.pdf ')).toBe('liste 2025.pdf');
    expect(nomFichierSur('\u0007')).toBeNull();
    expect(nomFichierSur(null)).toBeNull();
    expect(nomFichierSur('x'.repeat(301))!.length).toBe(300);
    expect(estViolationUnicite({ code: '23505' })).toBe(true);
    expect(estViolationUnicite({ cause: { code: '23505' } })).toBe(true);
    expect(estViolationUnicite({ code: '23503' })).toBe(false);
    expect(estViolationUnicite(null)).toBe(false);
  });
  it('normesLigne et instantDuJour', () => {
    expect(normesLigne({ rubrique: 'PÂTES À TARTINER', marque: 'Côte d’Or', produitLibelle: null })).toEqual({ rubriqueNorm: 'pates a tartiner', marqueNorm: 'cote d or', produitNorm: '' });
    expect(instantDuJour('2026-11-01')?.toISOString()).toBe('2026-11-01T12:00:00.000Z');
    expect(instantDuJour(null)).toBeNull();
    expect(instantDuJour('demain')).toBeNull();
  });
});
