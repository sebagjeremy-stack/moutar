import { describe, expect, it } from 'vitest';
import type { CertificationProduit, Produit, SousLigneListe } from '@moutar/shared-types';
import { analyserComposition } from '../analyse/analyse-composition-regles';
import { calculerSynthese, ligneCertifie, ligneComposition, ligneListeOfficielle, ligneSyntheseNiveau1, lignesSyntheseNiveau2 } from './carte-regles';

const p: Produit = { id: 'x', ean: '1', nom: 'Test', marque: null, imageUrl: null, ingredientsTexte: null, additifs: [], source: 'off', luLe: '2026-10-20T10:00:00Z' };

describe('lignes de la carte (lot 1)', () => {
  it('les niveaux 1 à 3 ne disent jamais « non »', () => {
    expect(ligneCertifie().statut).toBe('non_verifie');
    expect(ligneListeOfficielle().ton).toBe('warn');
    expect(ligneListeOfficielle().pastille).toBe('Non vérifié');
  });
  it('le niveau 4 n’est jamais vert et porte son avertissement', () => {
    const ok = ligneComposition(p, analyserComposition({ ingredientsTexte: 'farine, E322', additifsTags: [] }), new Date('2026-10-20T10:00:00Z'));
    expect(ok.ton).toBe('neutre');
    expect(ok.pastille).toContain('composition seule');
    expect(ok.avertissement).toMatch(/bichoul/);
    expect(ok.detail).toContain('lue le 20/10/2026');
    const non = ligneComposition(p, analyserComposition({ ingredientsTexte: 'gélatine', additifsTags: [] }), new Date());
    expect(non.ton).toBe('danger');
    expect(non.statut).toBe('non_casher');
  });
  it('sans ingrédients : « Ingrédients inconnus », ambre, sans avertissement', () => {
    const l = ligneComposition(p, null, new Date());
    expect(l.pastille).toBe('Ingrédients inconnus');
    expect(l.composition).toBeNull();
  });
});

const sous = (extra: Partial<SousLigneListe>): SousLigneListe => ({
  listeId: 'c1',
  code: 'consistoire_paris',
  source: 'Consistoire de Paris — Produits 2025-2026',
  publieLe: '2025-07-01',
  valableJusquAu: '2027-07-31',
  statut: 'non_cite',
  confiance: null,
  mention: null,
  detail: 'détail.',
  ligne: null,
  ...extra,
});

describe('ligne du niveau 2 (lot 2)', () => {
  it('sans liste active : « Non vérifié », ambre, aucune liste importée', () => {
    const l = ligneListeOfficielle([]);
    expect(l).toMatchObject({ statut: 'non_verifie', ton: 'warn', pastille: 'Non vérifié', sousLignes: [] });
    expect(l.detail).toMatch(/Aucune liste/);
    expect(lignesSyntheseNiveau2(l)).toEqual([expect.objectContaining({ niveau: 2, statut: 'non_verifie' })]);
  });
  it('cité par une marque : vert, « Cité · Consistoire », mention et validité portées', () => {
    const l = ligneListeOfficielle([sous({ statut: 'cite', confiance: 'forte', mention: 'lait non surveillé', ligne: { id: 'l1', rubrique: 'BISCUITS', marque: 'Lu', produitLibelle: null } })]);
    expect(l).toMatchObject({ statut: 'cite', ton: 'ok', pastille: 'Cité · Consistoire', mention: 'lait non surveillé', valableJusquAu: '2027-07-31' });
    expect(l.source).toContain('Consistoire');
  });
  it('cité par rubrique seulement : vert, pastille distincte, la mention dit la rubrique', () => {
    const l = ligneListeOfficielle([sous({ statut: 'cite_par_rubrique', confiance: 'faible', ligne: { id: 'l4', rubrique: 'YAOURTS', marque: null, produitLibelle: null } })]);
    expect(l.pastille).toBe('Cité par rubrique · Consistoire');
    expect(l.statut).toBe('cite');
    expect(l.mention).toBe('rubrique « YAOURTS », toute marque');
    expect(lignesSyntheseNiveau2(l)[0]).toMatchObject({ statut: 'cite', mention: 'rubrique « YAOURTS », toute marque' });
  });
  it('à confiance égale, l’ordre des listes ; une confiance forte passe devant une faible', () => {
    const faible = sous({ statut: 'cite', confiance: 'faible', ligne: { id: 'l1', rubrique: 'BISCUITS', marque: 'Lu', produitLibelle: null } });
    const forte = sous({ listeId: 'w', code: 'rav_wolff', source: 'Rav Wolff 2026', statut: 'cite', confiance: 'forte', ligne: { id: 'x', rubrique: 'Biscuits', marque: 'Lu', produitLibelle: 'Petit Beurre' } });
    const l = ligneListeOfficielle([faible, forte]);
    expect(l.pastille).toBe('Cité · Rav Wolff');
    expect(l.mention).toBeNull();
    expect(lignesSyntheseNiveau2(l).map((x) => x.source)).toEqual(['Rav Wolff 2026', 'Consistoire de Paris — Produits 2025-2026']);
    expect(calculerSynthese(lignesSyntheseNiveau2(l), 2, '2026-10-20').pastille).toBe('Permis · niveau 2');
  });
  it('une marque citée l’emporte sur une rubrique d’une autre liste ; une par liste pour la synthèse', () => {
    const wolff = sous({ listeId: 'w', code: 'rav_wolff', source: 'Rav Wolff 2026', valableJusquAu: '2026-11-01', statut: 'cite', confiance: 'forte', ligne: { id: 'x', rubrique: 'Biscuits', marque: 'Lu', produitLibelle: null } });
    const l = ligneListeOfficielle([sous({ statut: 'cite_par_rubrique', ligne: { id: 'l4', rubrique: 'BISCUITS', marque: null, produitLibelle: null } }), wolff]);
    expect(l.pastille).toBe('Cité · Rav Wolff');
    expect(l.detail).toContain('détail. détail.');
    // Une par liste, la confiance forte d'abord.
    expect(lignesSyntheseNiveau2(l).map((x) => [x.source, x.statut, x.valableJusquAu])).toEqual([
      ['Rav Wolff 2026', 'cite', '2026-11-01'],
      ['Consistoire de Paris — Produits 2025-2026', 'cite', '2027-07-31'],
    ]);
  });
  it('cité seulement par une liste périmée : ambre « Cité · liste périmée », jamais vert', () => {
    const l = ligneListeOfficielle([sous({ statut: 'perime', confiance: 'forte', ligne: { id: 'l1', rubrique: 'B', marque: 'Lu', produitLibelle: null } }), sous({ listeId: 'w', code: 'rav_wolff', source: 'Rav Wolff 2026' })]);
    expect(l).toMatchObject({ statut: 'perime', ton: 'warn', pastille: 'Cité · liste périmée' });
    const synthese = calculerSynthese(lignesSyntheseNiveau2(l), 2, '2026-10-20');
    expect(synthese.verdict).toBe('non_verifie');
    expect(synthese.pastille).toBe('Non vérifié · liste périmée');
  });
  it('non cité par toutes les listes : « Non cité », neutre (ce n’est pas un « non »)', () => {
    const l = ligneListeOfficielle([sous({}), sous({ listeId: 'w', code: 'rav_wolff', source: 'Rav Wolff 2026' })]);
    expect(l).toMatchObject({ statut: 'non_cite', ton: 'neutre', pastille: 'Non cité', source: null });
    expect(calculerSynthese(lignesSyntheseNiveau2(l), 2, '2026-10-20').verdict).toBe('non_verifie');
  });
  it('cité et valide → la synthèse dit « Permis », fondée sur la liste', () => {
    const l = ligneListeOfficielle([sous({ statut: 'cite', confiance: 'forte', mention: 'lait non surveillé', ligne: { id: 'l1', rubrique: 'B', marque: 'Lu', produitLibelle: null } })]);
    const s = calculerSynthese(lignesSyntheseNiveau2(l), 2, '2026-10-20');
    expect(s.verdict).toBe('permis');
    expect(s.pastille).toBe('Permis · lait non surveillé');
    expect(s.source).toContain('Consistoire');
  });
});

describe('marque citée sous une autre rubrique (confiance faible) — lot 3, correction du lot 2', () => {
  it('ne fonde plus un « permis » : ambre « Cité dans une autre rubrique · à vérifier », synthèse « Non vérifié »', () => {
    const l = ligneListeOfficielle([sous({ statut: 'cite', confiance: 'faible', mention: 'lait non surveillé', ligne: { id: 'l1', rubrique: 'BISCUITS SECS', marque: 'Lu', produitLibelle: null } })]);
    expect(l).toMatchObject({ statut: 'non_verifie', ton: 'warn', pastille: 'Cité dans une autre rubrique · à vérifier' });
    expect(l.source).toContain('Consistoire');
    expect(l.mention).toBe('lait non surveillé · rubrique « BISCUITS SECS » : à vérifier');
    expect(lignesSyntheseNiveau2(l)[0]).toMatchObject({ statut: 'non_verifie', mention: 'lait non surveillé · rubrique « BISCUITS SECS » : à vérifier' });
    const s = calculerSynthese(lignesSyntheseNiveau2(l), 2, '2026-10-20');
    expect(s.verdict).toBe('non_verifie');
    expect(s.pastille).toBe('Non vérifié · à vérifier');
    expect(s.phrase).toContain('sous une autre rubrique');
  });
  it('une citation forte par une autre liste l’emporte ; une citation par rubrique aussi (vert)', () => {
    const faible = sous({ statut: 'cite', confiance: 'faible', ligne: { id: 'l1', rubrique: 'BISCUITS SECS', marque: 'Lu', produitLibelle: null } });
    const rubrique = sous({ listeId: 'w', code: 'rav_wolff', source: 'Rav Wolff 2026', statut: 'cite_par_rubrique', confiance: 'faible', ligne: { id: 'x', rubrique: 'Pâtes à tartiner', marque: null, produitLibelle: null } });
    expect(ligneListeOfficielle([faible, rubrique]).pastille).toBe('Cité par rubrique · Rav Wolff');
    expect(lignesSyntheseNiveau2(ligneListeOfficielle([faible, rubrique])).map((x) => x.statut)).toEqual(['non_verifie', 'cite']);
  });
  it('une citation faible passe devant une liste périmée et devant « non cité »', () => {
    const faible = sous({ statut: 'cite', confiance: 'faible', ligne: { id: 'l1', rubrique: 'B', marque: 'Lu', produitLibelle: null } });
    const perimee = sous({ listeId: 'w', code: 'rav_wolff', source: 'Rav Wolff 2026', statut: 'perime', confiance: 'forte', ligne: { id: 'x', rubrique: 'B', marque: 'Lu', produitLibelle: null } });
    expect(ligneListeOfficielle([perimee, faible]).pastille).toBe('Cité dans une autre rubrique · à vérifier');
  });
});

const certification: CertificationProduit = {
  verdictId: 'v1',
  code: 'ou',
  nom: 'Orthodox Union (OU)',
  nomCourt: 'OU',
  mentions: ['parve'],
  mentionsLibelles: ['parvé'],
  texteLu: 'U',
  publieLe: '2026-10-20T10:00:00.000Z',
  certificateurActif: true,
};

describe('ligne du niveau 1 (lot 3)', () => {
  it('sans certification validée : « Aucun logo lu », neutre, jamais « non »', () => {
    const l = ligneCertifie(null);
    expect(l).toMatchObject({ niveau: 1, statut: 'non_verifie', ton: 'neutre', pastille: 'Aucun logo lu', source: null });
    expect(calculerSynthese([ligneSyntheseNiveau1(l, null)], 1, '2026-10-20').verdict).toBe('non_verifie');
  });
  it('certification validée : vert « Certifié · OU », mention, source, et la synthèse dit « Permis · OU · parvé »', () => {
    const l = ligneCertifie(certification);
    expect(l).toMatchObject({ statut: 'cite', ton: 'ok', pastille: 'Certifié · OU', mention: 'parvé', source: 'Orthodox Union (OU)', publieLe: certification.publieLe, valableJusquAu: null });
    expect(l.detail).toContain('validé par vous le 20/10/2026');
    expect(l.detail).toContain('texte lu : « U »');
    const s = calculerSynthese([ligneSyntheseNiveau1(l, certification)], 1, '2026-10-20');
    expect(s.verdict).toBe('permis');
    expect(s.pastille).toBe('Permis · OU · parvé');
    expect(s.source).toBe('Orthodox Union (OU)');
  });
  it('certificateur désactivé à la console depuis : ambre « Non vérifié », jamais vert', () => {
    const l = ligneCertifie({ ...certification, certificateurActif: false, mentions: [], mentionsLibelles: [], texteLu: null });
    expect(l).toMatchObject({ statut: 'non_verifie', ton: 'warn', pastille: 'Non vérifié', mention: null });
    expect(l.detail).toContain('plus reconnu');
    expect(calculerSynthese([ligneSyntheseNiveau1(l, { ...certification, certificateurActif: false })], 1, '2026-10-20').verdict).toBe('non_verifie');
  });
});
