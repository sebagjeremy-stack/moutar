import { describe, expect, it } from 'vitest';
import { analyserComposition, compterIngredients, extraireCodesE, extraireIngredientsSuspects, extraireSynonymes, type SurchargeAdditif } from './analyse-composition-regles';

describe('extraireCodesE', () => {
  it.each([
    ['émulsifiant : E322', ['E322']],
    ['e322, E 500, E-471', ['E322', 'E500', 'E471']],
    ['E160a et E472e', ['E160a', 'E472e']],
    ['E 472 e, E 160 a', ['E472e', 'E160a']],
    ['E450i, E450ii', ['E450']],
    ['E120i', ['E120']],
    ['E300 et sel', ['E300']],
    ['E1105', ['E1105']],
    ['vitamine E, sel', []],
    ['E32', []],
    ['E 1 2 0', []],
    ['CODE322', []],
  ])('%s → %j', (texte, attendu) => {
    expect(extraireCodesE(texte)).toEqual(attendu);
  });
});

describe('extraireSynonymes (mots entiers)', () => {
  it('reconnaît gélatine, cochenille, carmin, lécithine de soja', () => {
    expect(extraireSynonymes('sucre, gélatine, colorant : cochenille')).toEqual(['E441', 'E120']);
    expect(extraireSynonymes('carmin')).toEqual(['E120']);
    expect(extraireSynonymes('carmins (E120)')).toEqual([]);
    expect(extraireSynonymes('lécithine de soja')).toEqual(['E322']);
    expect(extraireSynonymes('lecithines')).toEqual(['E322']);
  });
  it('ne joue pas par inclusion', () => {
    expect(extraireSynonymes('gélatineux')).toEqual([]);
    expect(extraireSynonymes('carminatif')).toEqual([]);
  });
  it('un libellé composé n’est pas le synonyme : rouge cochenille A, carmin d’indigo, gélatine de poisson ou végétale', () => {
    expect(extraireSynonymes('colorant : rouge cochenille A')).toEqual([]);
    expect(extraireSynonymes('colorant : rouge cochenille A (E124)')).toEqual([]);
    expect(extraireSynonymes('carmin d’indigo')).toEqual([]);
    expect(extraireSynonymes("carmin d'indigo (E132)")).toEqual([]);
    expect(extraireSynonymes('gélatine de poisson')).toEqual([]);
    expect(extraireSynonymes('gélatine végétale')).toEqual([]);
    expect(extraireSynonymes('gélatine de porc')).toEqual(['E441']);
  });
  it('un code E entre parenthèses après le libellé l’emporte sur le synonyme', () => {
    expect(extraireSynonymes('émulsifiant : lécithine (E322), gélatine (E441)')).toEqual([]);
    expect(analyserComposition({ ingredientsTexte: 'gélatine (E441)', additifsTags: [] }).additifs.map((a) => a.code)).toEqual(['E441']);
  });
});

describe('extraireIngredientsSuspects', () => {
  it('lit porc, vin, présure ; pas vinaigre ni porcelaine', () => {
    expect(extraireIngredientsSuspects('lardons de porc, vin blanc')).toEqual([
      { libelle: 'porc', statut: 'non_casher' },
      { libelle: 'vin', statut: 'douteux' },
    ]);
    expect(extraireIngredientsSuspects('vinaigre, porcelaine, présure')).toEqual([{ libelle: 'présure', statut: 'douteux' }]);
  });
  it('jambon vaut « charcuterie » ; les moules à gâteaux ne sont pas des fruits de mer', () => {
    expect(extraireIngredientsSuspects('dés de jambon')).toEqual([{ libelle: 'charcuterie', statut: 'non_casher' }]);
    expect(extraireIngredientsSuspects('madeleines cuites dans des moules')).toEqual([]);
    expect(extraireIngredientsSuspects('crevettes, crabe')).toEqual([{ libelle: 'fruits de mer', statut: 'non_casher' }]);
  });
  it('viande, bœuf, volaille, fromage valent « viande ou fromage non certifiés » (douteux), une seule fois', () => {
    expect(extraireIngredientsSuspects('viande de bœuf, fromage, poulet')).toEqual([{ libelle: 'viande ou fromage non certifiés', statut: 'douteux' }]);
    expect(extraireIngredientsSuspects('boeuf')).toEqual([{ libelle: 'viande ou fromage non certifiés', statut: 'douteux' }]);
  });
});

describe('compterIngredients', () => {
  it('compte hors parenthèses', () => {
    expect(compterIngredients('farine, chocolat (cacao, sucre), sel')).toBe(3);
    expect(compterIngredients('')).toBe(0);
  });
});

describe('analyserComposition (table de cas)', () => {
  const cas: Array<[string, { texte: string | null; tags: string[] }, string, string[]]> = [
    ['rien de problématique', { texte: 'farine, sucre, E322 (lécithines de tournesol), E500', tags: ['en:e322i'] }, 'aucun_additif_problematique', ['E322', 'E500']],
    ['gélatine en toutes lettres', { texte: 'sucre, sirop de glucose, gélatine, arômes', tags: [] }, 'non_casher', ['E441']],
    ['cochenille par tag', { texte: null, tags: ['en:e120'] }, 'non_casher', ['E120']],
    ['E471 douteux', { texte: 'huile, E471', tags: [] }, 'douteux', ['E471']],
    ['code inconnu → douteux', { texte: 'E999', tags: [] }, 'douteux', ['E999']],
    ['porc dans le texte', { texte: 'viande de porc, sel', tags: [] }, 'non_casher', []],
    ['texte vide', { texte: null, tags: [] }, 'aucun_additif_problematique', []],
    // Les cinq cas de la relecture du 20/10/2026, et les bonus.
    ['rouge cochenille A (E124) → E124 seul, douteux (absent de la table), jamais E120', { texte: 'sucre, colorant : rouge cochenille A (E124)', tags: [] }, 'douteux', ['E124']],
    ['carmin d’indigo → rien (ou E132 si le code est écrit)', { texte: 'carmin d’indigo', tags: [] }, 'aucun_additif_problematique', []],
    ['carmin d’indigo (E132) → E132', { texte: "carmin d'indigo (E132)", tags: [] }, 'douteux', ['E132']],
    ['gélatine de poisson → douteux, sans E441', { texte: 'sucre, gélatine de poisson', tags: [] }, 'douteux', []],
    ['tag en:e428 → E428 non cacher', { texte: null, tags: ['en:e428'] }, 'non_casher', ['E428']],
    ['E120i → E120', { texte: 'E120i', tags: [] }, 'non_casher', ['E120']],
    ['viande de bœuf, sel → douteux', { texte: 'viande de bœuf, sel', tags: [] }, 'douteux', []],
    ['madeleines cuites dans des moules → rien', { texte: 'madeleines cuites dans des moules', tags: [] }, 'aucun_additif_problematique', []],
  ];
  it.each(cas)('%s', (_nom, entree, statut, codes) => {
    const r = analyserComposition({ ingredientsTexte: entree.texte, additifsTags: entree.tags });
    expect(r.statut).toBe(statut);
    expect(r.additifs.map((a) => a.code)).toEqual(codes);
  });

  it('gélatine de poisson et viande portent leur libellé ; un code absent de la table est « non répertorié »', () => {
    expect(analyserComposition({ ingredientsTexte: 'gélatine de poisson', additifsTags: [] }).ingredientsSuspects).toEqual(['gélatine : origine à examiner']);
    expect(analyserComposition({ ingredientsTexte: 'viande de bœuf, sel', additifsTags: [] }).ingredientsSuspects).toEqual(['viande ou fromage non certifiés']);
    expect(analyserComposition({ ingredientsTexte: 'rouge cochenille A (E124)', additifsTags: [] }).additifs[0]).toMatchObject({ code: 'E124', nom: 'non répertorié', statut: 'inconnu' });
  });

  it('un tag non reconnu est compté, jamais tu', () => {
    const r = analyserComposition({ ingredientsTexte: null, additifsTags: ['en:e160a-i', 'en:e14xx', 'en:e322'] });
    expect(r.tagsIgnores).toBe(2);
    expect(r.additifs.map((a) => a.code)).toEqual(['E322']);
    expect(analyserComposition({ ingredientsTexte: 'sel', additifsTags: [] }).tagsIgnores).toBe(0);
  });

  it('cite la source de chaque ligne et l’origine animale', () => {
    const r = analyserComposition({ ingredientsTexte: 'gélatine', additifsTags: [] });
    expect(r.additifs[0]).toMatchObject({ code: 'E441', nom: 'Gélatine', statut: 'non_casher', origineAnimalePossible: true });
    expect(r.additifs[0].source).toContain('connaissance générale');
  });

  it('la surcharge de console l’emporte sur le catalogue', () => {
    const surcharges = new Map<string, SurchargeAdditif>([['E441', { code: 'E441', statut: 'casher', source: 'liste de référence, p. 12 (gélatine de poisson)', note: null }]]);
    const r = analyserComposition({ ingredientsTexte: 'gélatine', additifsTags: [] }, surcharges);
    expect(r.statut).toBe('aucun_additif_problematique');
    expect(r.additifs[0].source).toContain('liste de référence');
  });

  it('les codes sont triés par numéro, sans doublon entre texte et tags', () => {
    const r = analyserComposition({ ingredientsTexte: 'E500, E322, E120', additifsTags: ['en:e322'] });
    expect(r.additifs.map((a) => a.code)).toEqual(['E120', 'E322', 'E500']);
    expect(r.nombreIngredients).toBe(3);
  });
});
