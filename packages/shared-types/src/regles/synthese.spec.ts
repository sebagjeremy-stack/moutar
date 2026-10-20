import { describe, expect, it } from 'vitest';
import { calculerSynthese, statutEffectif, type LigneSynthese } from './synthese';

const AUJOURDHUI = '2026-10-20';

const l = (p: Partial<LigneSynthese> & { niveau: LigneSynthese['niveau'] }): LigneSynthese => ({
  statut: 'non_verifie',
  source: null,
  mention: null,
  composition: null,
  ...p,
});

const rien = [l({ niveau: 1 }), l({ niveau: 2, statut: 'non_cite' }), l({ niveau: 3 }), l({ niveau: 4 })];

describe('calculerSynthese (seuil × lignes)', () => {
  it('rien de lu → non vérifié, scan des ingrédients proposé', () => {
    const s = calculerSynthese(rien, 2, AUJOURDHUI);
    expect(s.verdict).toBe('non_verifie');
    expect(s.ton).toBe('warn');
    expect(s.pastille).toBe('Non vérifié');
    expect(s.proposerScanIngredients).toBe(true);
  });

  it('liste officielle cite le produit, seuil 2 → permis fondé sur elle, avec sa mention', () => {
    const s = calculerSynthese(
      [l({ niveau: 1 }), l({ niveau: 2, statut: 'cite', source: 'la liste du Rav Wolff 2026', mention: 'lait non surveillé' }), l({ niveau: 3 }), l({ niveau: 4 })],
      2,
      AUJOURDHUI,
    );
    expect(s.verdict).toBe('permis');
    expect(s.pastille).toBe('Permis · lait non surveillé');
    expect(s.source).toBe('la liste du Rav Wolff 2026');
    expect(s.niveauFondateur).toBe(2);
    expect(s.phrase).toBe('Fondé sur la liste du Rav Wolff 2026.');
  });

  it('au-delà du seuil, une source ne compte pas', () => {
    const s = calculerSynthese([l({ niveau: 1 }), l({ niveau: 2, statut: 'cite', source: 'liste' }), l({ niveau: 3 }), l({ niveau: 4 })], 1, AUJOURDHUI);
    expect(s.verdict).toBe('non_verifie');
  });

  it('la plus haute source qui dit oui fonde la synthèse', () => {
    const s = calculerSynthese(
      [l({ niveau: 1, statut: 'permis', source: 'OU' }), l({ niveau: 2, statut: 'cite', source: 'liste' }), l({ niveau: 3 }), l({ niveau: 4 })],
      3,
      AUJOURDHUI,
    );
    expect(s.niveauFondateur).toBe(1);
    expect(s.source).toBe('OU');
  });

  it('une source périmée ne fonde jamais un permis', () => {
    const s = calculerSynthese([l({ niveau: 1 }), l({ niveau: 2, statut: 'perime', source: 'liste 2025' }), l({ niveau: 3 }), l({ niveau: 4 })], 2, AUJOURDHUI);
    expect(s.verdict).toBe('non_verifie');
    expect(s.ton).toBe('warn');
    expect(s.pastille).toBe('Non vérifié · liste périmée');
  });

  it('non cacher l’emporte sur tout, même sous une citation', () => {
    const s = calculerSynthese(
      [l({ niveau: 1 }), l({ niveau: 2, statut: 'non_casher', source: 'liste' }), l({ niveau: 3, statut: 'cite', source: 'LBPC' }), l({ niveau: 4 })],
      3,
      AUJOURDHUI,
    );
    expect(s.verdict).toBe('non_casher');
    expect(s.ton).toBe('danger');
    expect(s.pastille).toBe('Non cacher');
  });

  it('niveau 4 seul, sans additif : jamais vert, « composition seule »', () => {
    const s = calculerSynthese([rien[0], rien[1], rien[2], l({ niveau: 4, composition: 'aucun_additif_problematique', source: 'table d’additifs Moutar' })], 4, AUJOURDHUI);
    expect(s.verdict).toBe('non_verifie');
    expect(s.ton).toBe('warn');
    expect(s.pastille).toBe('Non vérifié · composition seule');
    expect(s.proposerScanIngredients).toBe(false);
  });

  it('niveau 4 non cacher (gélatine) → rouge, sous seuil 4', () => {
    const s = calculerSynthese([rien[0], rien[1], rien[2], l({ niveau: 4, statut: 'non_casher', composition: 'non_casher', source: 'table d’additifs Moutar' })], 4, AUJOURDHUI);
    expect(s.verdict).toBe('non_casher');
    expect(s.pastille).toBe('Non cacher · composition');
  });

  it('niveau 4 non cacher sous un seuil 2 : un « non » se lit à tout niveau (le plus protecteur, à valider)', () => {
    const s = calculerSynthese([rien[0], rien[1], rien[2], l({ niveau: 4, statut: 'non_casher', composition: 'non_casher' })], 2, AUJOURDHUI);
    expect(s.verdict).toBe('non_casher');
    expect(s.proposerScanIngredients).toBe(false);
  });

  it('composition lue sans problème, seuil 2 : non vérifié, sans proposer un nouveau scan', () => {
    const s = calculerSynthese([rien[0], rien[1], rien[2], l({ niveau: 4, composition: 'aucun_additif_problematique' })], 2, AUJOURDHUI);
    expect(s.verdict).toBe('non_verifie');
    expect(s.proposerScanIngredients).toBe(false);
  });

  it('une citation dont la validité est passée vaut périmé : non vérifié · liste périmée, jamais permis', () => {
    const lignes = [l({ niveau: 1 }), l({ niveau: 2, statut: 'cite', source: 'la liste du Rav Wolff 2026', valableJusquAu: '2026-11-01' }), l({ niveau: 3 }), l({ niveau: 4 })];
    expect(calculerSynthese(lignes, 2, '2026-10-20').verdict).toBe('permis');
    const s = calculerSynthese(lignes, 2, '2026-11-02');
    expect(s.verdict).toBe('non_verifie');
    expect(s.ton).toBe('warn');
    expect(s.pastille).toBe('Non vérifié · liste périmée');
    expect(s.source).toBe('la liste du Rav Wolff 2026');
    expect(statutEffectif(lignes[1], '2026-11-01')).toBe('cite');
    expect(statutEffectif(lignes[1], '2026-11-02')).toBe('perime');
  });

  it('seuil 4, liste périmée et composition douteuse : la pastille dit « additif douteux » (choix du 20/10/2026)', () => {
    const s = calculerSynthese(
      [l({ niveau: 1 }), l({ niveau: 2, statut: 'cite', source: 'liste 2025', valableJusquAu: '2025-11-01' }), l({ niveau: 3 }), l({ niveau: 4, composition: 'douteux', source: 'table' })],
      4,
      AUJOURDHUI,
    );
    expect(s.verdict).toBe('non_verifie');
    expect(s.pastille).toBe('Non vérifié · additif douteux');
  });
});

describe('synthèse : une marque citée sous une autre rubrique (lot 3, correction du lot 2)', () => {
  it('ne fonde pas un « permis » : « Non vérifié · à vérifier », fondé sur la liste, la mention dans la phrase', () => {
    const s = calculerSynthese(
      [
        { niveau: 1, statut: 'non_verifie', source: null, mention: null, composition: null },
        { niveau: 2, statut: 'non_verifie', source: 'Consistoire de Paris — Produits 2025-2026', mention: 'rubrique « BISCUITS SECS » : à vérifier', composition: null, valableJusquAu: '2027-07-31' },
        { niveau: 4, statut: 'non_verifie', source: null, mention: null, composition: null },
      ],
      2,
      '2026-10-20',
    );
    expect(s.verdict).toBe('non_verifie');
    expect(s.pastille).toBe('Non vérifié · à vérifier');
    expect(s.source).toContain('Consistoire');
    expect(s.phrase).toContain('sous une autre rubrique');
    expect(s.proposerScanIngredients).toBe(true);
  });
});

describe('synthèse : la communauté (lot 5, niveau 3)', () => {
  const communaute = (statut: LigneSynthese['statut'], mention: string | null) => l({ niveau: 3, statut, source: 'Les Bons Plans Cachères', mention });
  it('un « cite » validé fonde un « permis » seulement si le seuil atteint 3', () => {
    const lignes = [l({ niveau: 1 }), l({ niveau: 2, statut: 'non_cite' }), communaute('cite', 'communauté · LBPC'), l({ niveau: 4 })];
    expect(calculerSynthese(lignes, 3, AUJOURDHUI)).toMatchObject({ verdict: 'permis', pastille: 'Permis · communauté · LBPC', niveauFondateur: 3 });
    expect(calculerSynthese(lignes, 2, AUJOURDHUI)).toMatchObject({ verdict: 'non_verifie', pastille: 'Non vérifié' });
  });
  it('un « non_cite » communautaire ne fonde JAMAIS un « non cacher » : « Non vérifié », ambre', () => {
    const s = calculerSynthese([l({ niveau: 1 }), l({ niveau: 2, statut: 'non_cite' }), communaute('non_cite', null), l({ niveau: 4 })], 4, AUJOURDHUI);
    expect(s).toMatchObject({ verdict: 'non_verifie', ton: 'warn', pastille: 'Non vérifié' });
  });
  it('un « douteux » validé : « Non vérifié · douteux », fondé sur la communauté, la phrase le dit ; au seuil 2, rien', () => {
    const lignes = [l({ niveau: 1 }), l({ niveau: 2, statut: 'non_cite' }), communaute('non_verifie', 'signalé douteux'), l({ niveau: 4 })];
    const s = calculerSynthese(lignes, 3, AUJOURDHUI);
    expect(s).toMatchObject({ verdict: 'non_verifie', ton: 'warn', pastille: 'Non vérifié · douteux', source: 'Les Bons Plans Cachères', niveauFondateur: 3 });
    expect(s.phrase).toBe('Signalé douteux par Les Bons Plans Cachères (signalé douteux) : vérifiez avant d’acheter. Il reste la composition (niveau 4).');
    expect(calculerSynthese(lignes, 2, AUJOURDHUI).pastille).toBe('Non vérifié');
  });
});
