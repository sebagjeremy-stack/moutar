import { describe, expect, it } from 'vitest';
import type { CertificationProduit, ContributionPublique, Produit, SousLigneListe } from '@moutar/shared-types';
import { analyserComposition } from '../analyse/analyse-composition-regles';
import { calculerSynthese, ligneCertifie, ligneCommunautaire, ligneComposition, ligneListeOfficielle, ligneSyntheseNiveau1, ligneSyntheseNiveau3, lignesSyntheseNiveau2 } from './carte-regles';

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

const contrib = (extra: Partial<ContributionPublique>): ContributionPublique => ({
  id: 'c1',
  statutPropose: 'cite',
  sourceType: 'lbpc',
  sourceTexte: 'Validé par le groupe le 3 mai : « OK selon le Rav »',
  sourceDate: '2026-05-03',
  preuveUrl: 'https://facebook.com/groups/lbpc/posts/1',
  auteurNom: 'Sarah',
  valideeLe: '2026-10-20T10:00:00.000Z',
  ...extra,
});
const AUJOURDHUI = '2026-10-20';
const autour = (niveau3: ReturnType<typeof ligneCommunautaire>, seuil: 1 | 2 | 3 | 4) =>
  calculerSynthese([{ niveau: 1, statut: 'non_verifie', source: null, mention: null, composition: null }, { niveau: 2, statut: 'non_cite', source: null, mention: null, composition: null }, ligneSyntheseNiveau3(niveau3), { niveau: 4, statut: 'non_verifie', source: null, mention: null, composition: null }], seuil, AUJOURDHUI);

describe('ligne du niveau 3 (lot 5, contributions communautaires)', () => {
  it('rien : « Non vérifié », ambre, « Proposer une contribution »', () => {
    const l = ligneCommunautaire([], 0);
    expect(l).toMatchObject({ niveau: 3, statut: 'non_verifie', pastille: 'Non vérifié', ton: 'warn', source: null, publieLe: null, valableJusquAu: null, proposerContribution: true });
    expect(l.detail).toMatch(/proposer/i);
    expect(ligneCommunautaire()).toEqual(l);
  });
  it('aucune validée mais une proposée : « Contribution en attente de validation », ambre, rien ne compte', () => {
    const l = ligneCommunautaire([], 2);
    expect(l).toMatchObject({ statut: 'non_verifie', pastille: 'Contribution en attente de validation', ton: 'warn', source: null, proposerContribution: true });
    expect(l.detail).toContain('2 contributions proposées');
    expect(autour(l, 3).verdict).toBe('non_verifie');
  });
  it('validée « cite » : vert « Validé par la communauté · LBPC », source LBPC, publié le jour de la source, détail = ce que dit la source', () => {
    const l = ligneCommunautaire([contrib({})], 0);
    expect(l).toMatchObject({ statut: 'cite', pastille: 'Validé par la communauté · LBPC', ton: 'ok', source: 'Les Bons Plans Cachères', mention: 'communauté · LBPC', publieLe: '2026-05-03', valableJusquAu: null, proposerContribution: false });
    expect(l.detail).toContain('« Validé par le groupe le 3 mai : « OK selon le Rav » »');
    expect(l.detail).toContain('Source datée du 03/05/2026');
    expect(l.detail).toContain('proposée par « Sarah »');
    expect(l.detail).toContain('validée le 20/10/2026');
    expect(l.detail).toContain('preuve jointe');
  });
  it('le détail tronque ce que dit la source à 200 caractères', () => {
    const l = ligneCommunautaire([contrib({ sourceTexte: 'x'.repeat(300) })], 0);
    expect(l.detail).toContain(`« ${'x'.repeat(199)}… »`);
    expect(l.detail).not.toContain('x'.repeat(200));
  });
  it('sans date de source ni pseudonyme ni preuve : publié à la validation, « Source non datée »', () => {
    const l = ligneCommunautaire([contrib({ sourceDate: null, auteurNom: null, preuveUrl: null })], 0);
    expect(l.publieLe).toBe('2026-10-20T10:00:00.000Z');
    expect(l.detail).toContain('Source non datée');
    expect(l.detail).not.toMatch(/proposée par|preuve/);
  });
  it('validée « douteux » : ambre « Signalé douteux par la communauté », statut non_verifie, mention « signalé douteux »', () => {
    const l = ligneCommunautaire([contrib({ statutPropose: 'douteux' })], 0);
    expect(l).toMatchObject({ statut: 'non_verifie', pastille: 'Signalé douteux par la communauté', ton: 'warn', source: 'Les Bons Plans Cachères', mention: 'signalé douteux', proposerContribution: false });
  });
  it('validée « non_cite » : neutre « Non cité par la communauté », statut non_cite — jamais un « non »', () => {
    const l = ligneCommunautaire([contrib({ statutPropose: 'non_cite' })], 0);
    expect(l).toMatchObject({ statut: 'non_cite', pastille: 'Non cité par la communauté', ton: 'neutre', source: 'Les Bons Plans Cachères', mention: null });
    expect(l.detail).toContain('Ce n’est pas un « non »');
  });
  it('la source « autre » : « Validé par la communauté · communauté », fondée sur « Communauté Moutar »', () => {
    const l = ligneCommunautaire([contrib({ sourceType: 'autre' })], 0);
    expect(l).toMatchObject({ pastille: 'Validé par la communauté · communauté', source: 'Communauté Moutar', mention: 'communauté · communauté' });
  });
  it('plusieurs validées : la plus récente par le jour de sa source fonde la ligne, même si une proposée attend', () => {
    const vieille = contrib({ id: 'a', statutPropose: 'cite', sourceDate: '2026-01-10' });
    const recente = contrib({ id: 'b', statutPropose: 'douteux', sourceDate: '2026-09-01' });
    expect(ligneCommunautaire([vieille, recente], 1).pastille).toBe('Signalé douteux par la communauté');
    expect(ligneCommunautaire([recente, vieille], 0).pastille).toBe('Signalé douteux par la communauté');
    expect(ligneCommunautaire([vieille], 0).pastille).toBe('Validé par la communauté · LBPC');
  });
  it('jamais rouge, jamais non_casher, quel que soit le statut proposé', () => {
    for (const statutPropose of ['cite', 'non_cite', 'douteux'] as const) {
      const l = ligneCommunautaire([contrib({ statutPropose })], 0);
      expect(l.ton).not.toBe('danger');
      expect(l.statut).not.toBe('non_casher');
      expect(ligneSyntheseNiveau3(l).statut).not.toBe('non_casher');
      expect(autour(l, 4).verdict).not.toBe('non_casher');
    }
  });
  it('synthèse : un « cite » validé fonde un « permis » au seuil 3 ou 4 seulement ; au seuil 2, « non vérifié »', () => {
    const l = ligneCommunautaire([contrib({})], 0);
    expect(autour(l, 3)).toMatchObject({ verdict: 'permis', pastille: 'Permis · communauté · LBPC', source: 'Les Bons Plans Cachères', niveauFondateur: 3 });
    expect(autour(l, 4).verdict).toBe('permis');
    expect(autour(l, 2)).toMatchObject({ verdict: 'non_verifie', pastille: 'Non vérifié' });
    expect(autour(l, 1).verdict).toBe('non_verifie');
  });
  it('synthèse : un « non_cite » communautaire → « Non vérifié » ambre, JAMAIS rouge ; un « douteux » → « Non vérifié · douteux »', () => {
    const nonCite = autour(ligneCommunautaire([contrib({ statutPropose: 'non_cite' })], 0), 3);
    expect(nonCite).toMatchObject({ verdict: 'non_verifie', ton: 'warn', pastille: 'Non vérifié' });
    const douteux = autour(ligneCommunautaire([contrib({ statutPropose: 'douteux' })], 0), 3);
    expect(douteux).toMatchObject({ verdict: 'non_verifie', ton: 'warn', pastille: 'Non vérifié · douteux', source: 'Les Bons Plans Cachères', niveauFondateur: 3 });
    expect(douteux.phrase).toContain('Signalé douteux par Les Bons Plans Cachères');
    expect(autour(ligneCommunautaire([contrib({ statutPropose: 'douteux' })], 0), 2).pastille).toBe('Non vérifié');
  });
  it('synthèse : une liste officielle qui cite l’emporte sur la communauté (niveau plus haut) ; un « non cacher » de la composition l’emporte sur un « cite » communautaire', () => {
    const communaute = ligneSyntheseNiveau3(ligneCommunautaire([contrib({})], 0));
    const liste = calculerSynthese([{ niveau: 2, statut: 'cite', source: 'Consistoire', mention: null, composition: null }, communaute], 3, AUJOURDHUI);
    expect(liste).toMatchObject({ verdict: 'permis', niveauFondateur: 2 });
    const non = calculerSynthese([communaute, { niveau: 4, statut: 'non_casher', source: 'Table', mention: null, composition: 'non_casher' }], 3, AUJOURDHUI);
    expect(non).toMatchObject({ verdict: 'non_casher', niveauFondateur: 4 });
  });
});
