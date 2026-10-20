import { describe, expect, it } from 'vitest';
import { contientUneLettre, estEnMajuscules, lignesDuTexte, lireLigneProduit, lireMention, rubriqueReservee } from './analyse-liste-commun';
import { analyserTexteConsistoire } from './analyse-liste-consistoire';
import { analyserCsv } from './analyse-liste-csv';
import { analyserTexteRavWolff } from './analyse-liste-rav-wolff';

/* Échantillons FICTIFS : ils imitent la structure connue des sources (cadrage § 2), aucun n'est copié d'un vrai fichier. */

const CONSISTOIRE = `Consistoire de Paris
Produits 2025-2026
Liste fictive des produits autorisés (édition d'essai).
1

BISCUITS SECS
Lu
Saint Michel (L)
Bonne Maman : Tartelettes fraise, Galettes bretonnes
Biscotto, Croquor

YAOURTS

CHARCUTERIE
Zelbo
Chochana

VINS

PÂTES À TARTINER (L)
Chocoland

CONFITURES
Toutes marques
Belle Confiture

2
`;

describe('analyserTexteConsistoire (échantillon fictif)', () => {
  const r = analyserTexteConsistoire(CONSISTOIRE);
  const sous = (rubrique: string) => r.lignes.filter((l) => l.rubrique === rubrique);

  it('lit les rubriques en majuscules et leurs marques', () => {
    expect(sous('BISCUITS SECS').map((l) => l.marque)).toEqual(['Lu', 'Saint Michel', 'Bonne Maman', 'Bonne Maman', 'Biscotto', 'Croquor']);
  });
  it('« (L) » devient la mention lait_non_surveille, retirée du nom', () => {
    const sm = sous('BISCUITS SECS').find((l) => l.marque === 'Saint Michel')!;
    expect(sm.mention).toBe('lait_non_surveille');
    const lu = sous('BISCUITS SECS').find((l) => l.marque === 'Lu')!;
    expect(lu.mention).toBeNull();
  });
  it('« Marque : produit, produit » donne une ligne par produit nommé', () => {
    const bm = sous('BISCUITS SECS').filter((l) => l.marque === 'Bonne Maman');
    expect(bm.map((l) => l.produitLibelle)).toEqual(['Tartelettes fraise', 'Galettes bretonnes']);
  });
  it('« A, B » sur une ligne donne deux marques', () => {
    expect(sous('BISCUITS SECS').filter((l) => ['Biscotto', 'Croquor'].includes(l.marque ?? '')).length).toBe(2);
  });
  it('une rubrique sans ligne vaut « toute marque », avec un avertissement qui la NOMME (est-ce une marque ?)', () => {
    expect(sous('YAOURTS')).toEqual([expect.objectContaining({ touteMarque: true, marque: null, produitLibelle: null, rubriqueReservee: false })]);
    expect(r.avertissements).toContain('Rubrique « YAOURTS » sans aucune marque : lue comme « toute marque autorisée » — est-ce une marque ?');
  });
  it('une rubrique réservée (charcuterie) porte rubriqueReservee et n’est jamais « toute marque »', () => {
    const ch = sous('CHARCUTERIE');
    expect(ch.map((l) => l.marque)).toEqual(['Zelbo', 'Chochana']);
    expect(ch.every((l) => l.rubriqueReservee && !l.touteMarque)).toBe(true);
  });
  it('une rubrique réservée vide (vins) ne produit aucune ligne, et un avertissement', () => {
    expect(sous('VINS')).toEqual([]);
    expect(r.avertissements.some((a) => a.includes('« VINS »'))).toBe(true);
  });
  it('une mention sur la rubrique vaut pour ses lignes', () => {
    expect(sous('PÂTES À TARTINER')).toEqual([expect.objectContaining({ marque: 'Chocoland', mention: 'lait_non_surveille' })]);
  });
  it('« Toutes marques » explicite sous une rubrique la rend « toute marque » en plus des marques nommées, SANS avertissement', () => {
    const c = sous('CONFITURES');
    expect(c.some((l) => l.touteMarque)).toBe(true);
    expect(c.some((l) => l.marque === 'Belle Confiture')).toBe(true);
    expect(r.avertissements.some((a) => a.includes('« CONFITURES »'))).toBe(false);
  });
  it('les en-têtes de la source (« Consistoire de Paris », « Produits 2025-2026 ») et les numéros de page sont du bruit ; le reste du préambule devient la note ; l’ordre est croissant', () => {
    expect(r.note).toBe("Liste fictive des produits autorisés (édition d'essai).");
    expect(r.lignes.some((l) => l.marque === '1' || l.rubrique === '2')).toBe(false);
    expect(r.lignes.map((l) => l.ordre)).toEqual(r.lignes.map((_, i) => i));
  });
  it('sans aucune rubrique : un avertissement, aucune ligne', () => {
    const vide = analyserTexteConsistoire('juste du texte\nsans rubrique');
    expect(vide.lignes).toEqual([]);
    expect(vide.avertissements[0]).toMatch(/Aucune rubrique/);
  });
  it('un renvoi (« voir … ») est signalé, pas lu comme une marque', () => {
    const r2 = analyserTexteConsistoire('CAFÉS\nvoir rubrique BOISSONS\nCarte Noire');
    expect(r2.lignes.map((l) => l.marque)).toEqual(['Carte Noire']);
    expect(r2.avertissements[0]).toMatch(/renvoi/i);
    expect(r2.avertissements[0]).toContain('« voir rubrique BOISSONS »');
  });
});

describe('heuristiques de la relecture (échantillons fictifs)', () => {
  it('une ligne en MAJUSCULES d’un ou deux mots, collée aux marques et sans rien dessous, est une MARQUE de la rubrique, pas une rubrique', () => {
    const r = analyserTexteConsistoire('YAOURTS\nCANDIA\nBISCUITS\nLu');
    expect(r.lignes.map((l) => [l.rubrique, l.marque, l.touteMarque])).toEqual([
      ['YAOURTS', 'CANDIA', false],
      ['BISCUITS', 'Lu', false],
    ]);
    expect(r.avertissements.some((a) => a.includes('« CANDIA »') && /marque/.test(a))).toBe(true);
  });
  it('… mais une ligne en MAJUSCULES précédée d’une ligne vide, ou avec des lignes dessous, reste une rubrique', () => {
    const r = analyserTexteConsistoire('YAOURTS\nDanone\n\nCANDIA\nBISCUITS\nLu\nCONFITURES\nBonne Maman');
    expect(r.lignes.map((l) => [l.rubrique, l.marque, l.touteMarque])).toEqual([
      ['YAOURTS', 'Danone', false],
      ['CANDIA', null, true],
      ['BISCUITS', 'Lu', false],
      ['CONFITURES', 'Bonne Maman', false],
    ]);
    expect(r.avertissements).toEqual(['Rubrique « CANDIA » sans aucune marque : lue comme « toute marque autorisée » — est-ce une marque ?']);
  });
  it('« LU » en majuscules sous « BISCUITS », suivi d’une autre rubrique, est la marque Lu (le piège connu du lot 2)', () => {
    const r = analyserTexteConsistoire('BISCUITS\nLU\nCONFITURES\nBonne Maman');
    expect(r.lignes.map((l) => [l.rubrique, l.marque])).toEqual([
      ['BISCUITS', 'LU'],
      ['CONFITURES', 'Bonne Maman'],
    ]);
  });
  it('une rubrique RÉSERVÉE collée aux marques (« VINS », vide par nature) reste une rubrique, jamais une marque', () => {
    const r = analyserTexteConsistoire('BISCUITS\nLu\nVINS\nCONFITURES\nBonne Maman\nFROMAGES');
    expect(r.lignes.map((l) => [l.rubrique, l.marque])).toEqual([
      ['BISCUITS', 'Lu'],
      ['CONFITURES', 'Bonne Maman'],
    ]);
    expect(r.avertissements.filter((a) => a.includes('réservée'))).toHaveLength(2);
  });
  it('une césure (« Bonne Ma- » / « man ») se recolle', () => {
    expect(lignesDuTexte('Bonne Ma-\nman : Tartelettes\nLu')).toEqual(['Bonne Maman : Tartelettes', 'Lu']);
    const r = analyserTexteConsistoire('BISCUITS\nBonne Ma-\nman\nLu');
    expect(r.lignes.map((l) => l.marque)).toEqual(['Bonne Maman', 'Lu']);
  });
  it('« Lu - » (séparateur en fin de ligne) n’est pas une césure', () => {
    expect(lignesDuTexte('Lu -\nPetit Beurre')).toEqual(['Lu -', 'Petit Beurre']);
  });
  it('« sauf », « hors », « voir », « cf. » n’importe où dans une ligne → avertissement qui cite la ligne', () => {
    const r = analyserTexteConsistoire('CHOCOLATS\nMilka : voir CONFISERIE\nCôte d’Or (sauf fourrés)\nLindt hors gammes liqueur\ncf. tableau\nNestlé');
    expect(r.avertissements.filter((a) => a.includes('« Milka : voir CONFISERIE »'))).toHaveLength(1);
    expect(r.avertissements.some((a) => a.includes('« Côte d’Or (sauf fourrés) »'))).toBe(true);
    expect(r.avertissements.some((a) => a.includes('« Lindt hors gammes liqueur »'))).toBe(true);
    expect(r.avertissements.some((a) => a.includes('« cf. tableau »'))).toBe(true);
    // Le renvoi n'est pas lu comme un produit de Milka ; la restriction de Côte d'Or reste sa mention ; Nestlé passe sans bruit.
    expect(r.lignes.map((l) => [l.marque, l.produitLibelle, l.mention])).toEqual([
      ['Milka', null, null],
      ['Côte d’Or', null, 'sauf fourrés'],
      ['Lindt hors gammes liqueur', null, null],
      ['Nestlé', null, null],
    ]);
  });
  it('« TOUTES MARQUES » en majuscules sous YAOURTS vaut « toute marque », pas une rubrique', () => {
    const r = analyserTexteConsistoire('YAOURTS\nTOUTES MARQUES\nBISCUITS\nLu');
    expect(r.lignes.map((l) => [l.rubrique, l.marque, l.touteMarque])).toEqual([
      ['YAOURTS', null, true],
      ['BISCUITS', 'Lu', false],
    ]);
    expect(r.avertissements).toEqual([]);
  });
  it('une ligne « Titre : » de plus de quatre mots n’est pas une rubrique (avertissement « ignorée »)', () => {
    const r = analyserTexteConsistoire('BISCUITS\nLu\nLes produits suivants sont autorisés sous réserve :\nPrince');
    expect(r.lignes.map((l) => l.marque)).toEqual(['Lu', 'Prince']);
    expect(r.avertissements.some((a) => /ignorée/.test(a) && a.includes('« Les produits suivants sont autorisés sous réserve : »'))).toBe(true);
    expect(analyserTexteConsistoire('Pâtes à tartiner :\nChocoland').lignes.map((l) => l.rubrique)).toEqual(['Pâtes à tartiner']);
  });
  it('bruit : « page N », « - N - », « Produits 2025-2026 », « Rav Wolff », le titre fourni, un code-barres nu', () => {
    const r = analyserTexteConsistoire('BISCUITS\nLu\npage 3\n- 4 -\nProduits 2025-2026\nRav Wolff\nMon édition\n3017760000001\nPrince', { titre: 'Mon édition' });
    expect(r.lignes.map((l) => l.marque)).toEqual(['Lu', 'Prince']);
    expect(r.avertissements).toEqual([]);
  });
  it('une marque sans lettre n’existe pas (avertissement) ; une marque d’un seul caractère est gardée mais signalée', () => {
    const r = analyserTexteConsistoire('BISCUITS\nLu, 15, 2024, X');
    expect(r.lignes.map((l) => l.marque)).toEqual(['Lu', 'X']);
    expect(r.avertissements.some((a) => a.includes('« 15 »'))).toBe(true);
    expect(r.avertissements.some((a) => a.includes('« 2024 »'))).toBe(true);
    expect(r.avertissements.some((a) => a.includes("« X »") && /seul caractère/.test(a))).toBe(true);
    expect(contientUneLettre('15 -')).toBe(false);
    expect(contientUneLettre('Lu')).toBe(true);
  });
});

const RAV_WOLFF = `Liste du Rav Wolff 2026
Les avis ci-dessous sont indulgents : chacun suivra son rabbin.
Valable jusqu'au 1er novembre 2026.

Biscuits :
Lu – Petit Beurre, Prince
Gerblé (lait non surveillé)

Chocolats
Milka (sauf les gammes fourrées)
Côte d'Or

FROMAGES :
Toutes marques
Zelbo
`;

describe('analyserTexteRavWolff (échantillon fictif)', () => {
  const r = analyserTexteRavWolff(RAV_WOLFF);
  const sous = (rubrique: string) => r.lignes.filter((l) => l.rubrique === rubrique);

  it('garde la note d’introduction', () => {
    expect(r.note).toContain('indulgents');
    expect(r.note).toContain('1er novembre 2026');
  });
  it('la première ligne du fichier n’est jamais un titre de rubrique : « Introduction … » reste dans la note', () => {
    const r2 = analyserTexteRavWolff('Introduction\nLes avis sont indulgents.\n\nBiscuits :\nLu');
    expect(r2.note).toBe('Introduction\nLes avis sont indulgents.');
    expect(r2.lignes.map((l) => [l.rubrique, l.marque])).toEqual([['Biscuits', 'Lu']]);
    const r3 = analyserTexteRavWolff('Introduction\n\nBiscuits\nLu');
    expect(r3.note).toBe('Introduction');
    expect(r3.lignes.map((l) => [l.rubrique, l.marque])).toEqual([['Biscuits', 'Lu']]);
  });
  it('une rubrique « Titre : » et un tiret « – » entre marque et produits', () => {
    expect(sous('Biscuits').map((l) => [l.marque, l.produitLibelle])).toEqual([
      ['Lu', 'Petit Beurre'],
      ['Lu', 'Prince'],
      ['Gerblé', null],
    ]);
  });
  it('« lait non surveillé » en toutes lettres devient la mention', () => {
    expect(sous('Biscuits').find((l) => l.marque === 'Gerblé')!.mention).toBe('lait_non_surveille');
  });
  it('un titre court isolé par une ligne vide est une rubrique ; une parenthèse libre est une mention libre (et « sauf » est signalé)', () => {
    const ch = sous('Chocolats');
    expect(ch.map((l) => l.marque)).toEqual(['Milka', "Côte d'Or"]);
    expect(ch[0].mention).toBe('sauf les gammes fourrées');
    expect(r.avertissements.some((a) => a.includes('« Milka (sauf les gammes fourrées) »'))).toBe(true);
  });
  it('« toutes marques » sous une rubrique réservée (fromages) est refusé, les marques nommées restent', () => {
    expect(sous('FROMAGES').map((l) => l.marque)).toEqual(['Zelbo']);
    expect(sous('FROMAGES').every((l) => l.rubriqueReservee && !l.touteMarque)).toBe(true);
    expect(r.avertissements.some((a) => a.includes('FROMAGES'))).toBe(true);
  });
});

describe('analyserCsv', () => {
  it('lit rubrique;marque;produit;mention avec en-tête, devine le séparateur', () => {
    const r = analyserCsv('rubrique;marque;produit;mention\nBISCUITS;Lu;;\nBISCUITS;Lu;Prince;L\nYAOURTS;;;\nYAOURTS;;;\n');
    expect(r.lignes).toEqual([
      expect.objectContaining({ rubrique: 'BISCUITS', marque: 'Lu', produitLibelle: null, mention: null, touteMarque: false }),
      expect.objectContaining({ rubrique: 'BISCUITS', marque: 'Lu', produitLibelle: 'Prince', mention: 'lait_non_surveille' }),
      expect.objectContaining({ rubrique: 'YAOURTS', touteMarque: true }),
    ]);
    expect(r.avertissements).toEqual([]);
  });
  it('virgule et guillemets ; rubrique réservée sans marque ignorée avec avertissement ; ligne sans rubrique signalée', () => {
    const r = analyserCsv('"Jus de raisin",,,\nVins,"Château, Lévy",,"lait non surveillé"\n,Lu,,');
    expect(r.lignes).toEqual([expect.objectContaining({ rubrique: 'Vins', marque: 'Château, Lévy', rubriqueReservee: true, mention: 'lait_non_surveille' })]);
    expect(r.avertissements.length).toBe(2);
  });
  it('un fichier vide le dit', () => {
    expect(analyserCsv('  \n').avertissements).toEqual(['Fichier vide.']);
  });
});

describe('briques du socle', () => {
  it('rubriqueReservee : viande, charcuterie, vin, jus de raisin, fromage (et pluriels), pas les autres', () => {
    for (const r of ['VIANDES', 'Charcuterie fine', 'VINS ET SPIRITUEUX', 'Jus de raisin', 'FROMAGES']) expect(rubriqueReservee(r)).toBe(true);
    for (const r of ['BISCUITS SECS', 'Jus de fruits', 'VINAIGRES', 'Fromentine']) expect(rubriqueReservee(r)).toBe(false);
  });
  it('estEnMajuscules tolère chiffres, accents et ponctuation', () => {
    expect(estEnMajuscules('PÂTES À TARTINER (L)')).toBe(true);
    expect(estEnMajuscules('Lu')).toBe(false);
    expect(estEnMajuscules('OK')).toBe(false);
  });
  it('lireMention : (L), (l), toutes lettres, parenthèse libre, rien', () => {
    expect(lireMention('Saint Michel (L)')).toEqual({ texte: 'Saint Michel', mention: 'lait_non_surveille' });
    expect(lireMention('Gerblé (l)')).toEqual({ texte: 'Gerblé', mention: 'lait_non_surveille' });
    expect(lireMention('Gerblé lait non surveillé')).toEqual({ texte: 'Gerblé', mention: 'lait_non_surveille' });
    expect(lireMention('Milka (sauf fourrés)')).toEqual({ texte: 'Milka', mention: 'sauf fourrés' });
    expect(lireMention('Lu')).toEqual({ texte: 'Lu', mention: null });
  });
  it('lireLigneProduit : « Marque - produit » et « Marque: p1 ; p2 »', () => {
    expect(lireLigneProduit('Lu - Petit Beurre', 'B', false)).toEqual([expect.objectContaining({ marque: 'Lu', produitLibelle: 'Petit Beurre' })]);
    expect(lireLigneProduit('Lu: Prince ; Pim’s (L)', 'B', false).map((l) => [l.marque, l.produitLibelle, l.mention])).toEqual([
      ['Lu', 'Prince', 'lait_non_surveille'],
      ['Lu', 'Pim’s', 'lait_non_surveille'],
    ]);
    expect(lireLigneProduit('(L)', 'B', false)).toEqual([]);
  });
  it('lireLigneProduit : une marque sans lettre est écartée, un renvoi en produit n’est pas lu', () => {
    const avertissements: string[] = [];
    expect(lireLigneProduit('15 - Petit Beurre', 'B', false, avertissements)).toEqual([]);
    expect(lireLigneProduit('Milka : voir CONFISERIE', 'B', false, avertissements)).toEqual([expect.objectContaining({ marque: 'Milka', produitLibelle: null })]);
    expect(avertissements).toHaveLength(2);
  });
});

describe('codeMention (saisie manuelle, CSV)', () => {
  it('reconnaît L, (L), lait non surveillé ; garde un texte libre ; rien pour vide', async () => {
    const { codeMention } = await import('./analyse-liste-commun');
    expect(codeMention('L')).toBe('lait_non_surveille');
    expect(codeMention(' (l) ')).toBe('lait_non_surveille');
    expect(codeMention('Lait non surveillé')).toBe('lait_non_surveille');
    expect(codeMention('sauf bio')).toBe('sauf bio');
    expect(codeMention('  ')).toBeNull();
  });
});
