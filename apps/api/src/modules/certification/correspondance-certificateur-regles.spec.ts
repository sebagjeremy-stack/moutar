import { describe, expect, it } from 'vitest';
import type { LectureLogo } from '@moutar/shared-types';
import { CERTIFICATEURS } from '@moutar/shared-types/catalogues/certificateurs';
import { correspondreCertificateurs, formeCorrespond, lireMentions } from './correspondance-certificateur-regles';

const lecture = (candidats: LectureLogo['candidats'], mentions: string[] = [], autresTextes: string[] = []): LectureLogo => ({ candidats, mentions, autresTextes });
const codes = (l: LectureLogo, catalogue = CERTIFICATEURS) => correspondreCertificateurs(l, catalogue).propositions.map((p) => p.code);

describe('correspondance des certificateurs (règle pure, lot 3)', () => {
  it('un U dans un cercle, mention PARVE → OU, parvé, texte lu « U »', () => {
    const r = correspondreCertificateurs(lecture([{ texteLu: 'U', forme: 'lettre U dans un cercle', confiance: 1 }], ['PARVE']), CERTIFICATEURS);
    expect(r.aucun).toBe(false);
    expect(r.propositions).toEqual([{ code: 'ou', nom: 'Orthodox Union (OU)', nomCourt: 'OU', confiance: 0.9, texteLu: 'U', mentions: ['parve'] }]);
    expect(r.candidatsNonReconnus).toEqual([]);
  });
  it('« OU » lu sans cercle ni « Orthodox Union » ne vaut rien (« ou » est aussi un mot français)', () => {
    expect(codes(lecture([{ texteLu: 'OU', forme: 'deux lettres côte à côte', confiance: 0.9 }]))).toEqual([]);
    expect(codes(lecture([{ texteLu: 'parve ou halavi', forme: 'texte', confiance: 0.9 }]))).toEqual([]);
    expect(codes(lecture([{ texteLu: 'OU', forme: 'U dans un rond', confiance: 0.9 }]))).toEqual(['ou']);
    expect(codes(lecture([{ texteLu: 'Orthodox Union', forme: 'texte sous un symbole', confiance: 0.8 }]))).toEqual(['ou']);
  });
  it('« OK » ne se lit pas dans « OKAY » ni dans une phrase ; « OK » seul dans un cercle, oui', () => {
    expect(codes(lecture([{ texteLu: 'OKAY', forme: 'K dans un cercle', confiance: 1 }]))).toEqual([]);
    expect(codes(lecture([{ texteLu: 'ok pour tous', forme: 'cercle', confiance: 1 }]))).toEqual([]);
    expect(codes(lecture([{ texteLu: 'OK', forme: 'lettre K dans un cercle', confiance: 1 }]))).toEqual(['ok']);
    expect(codes(lecture([{ texteLu: 'OK Kosher', forme: 'texte', confiance: 1 }]))).toEqual(['ok']);
  });
  it('un K seul : dans un cercle → OK ; dans une étoile → Star-K ; dans un kof hébraïque → Kof-K ; sans forme → rien', () => {
    expect(codes(lecture([{ texteLu: 'K', forme: 'K dans un cercle', confiance: 1 }]))).toEqual(['ok']);
    expect(codes(lecture([{ texteLu: 'K', forme: 'K dans une étoile à cinq branches', confiance: 1 }]))).toEqual(['star_k']);
    expect(codes(lecture([{ texteLu: 'K', forme: 'K à l’intérieur d’une lettre hébraïque kof', confiance: 1 }]))).toEqual(['kof_k']);
    expect(codes(lecture([{ texteLu: 'K', forme: '', confiance: 1 }]))).toEqual([]);
  });
  it('les mentions du symbole lui-même : « OU-D » → OU halavi ; « OU P » → Pessah ; « K PARVE » dans une étoile → Star-K parvé', () => {
    const d = correspondreCertificateurs(lecture([{ texteLu: 'OU-D', forme: 'U dans un cercle suivi de D', confiance: 0.9 }]), CERTIFICATEURS);
    expect(d.propositions[0]).toMatchObject({ code: 'ou', mentions: ['halavi'] });
    expect(correspondreCertificateurs(lecture([{ texteLu: 'OU P', forme: 'cercle', confiance: 0.9 }]), CERTIFICATEURS).propositions[0]?.mentions).toEqual(['pessah']);
    expect(correspondreCertificateurs(lecture([{ texteLu: 'K PARVE', forme: 'étoile', confiance: 0.9 }]), CERTIFICATEURS).propositions[0]).toMatchObject({ code: 'star_k', mentions: ['parve'] });
  });
  it('les sigles et noms longs se lisent en mots entiers, sans accent ni casse, dans une phrase', () => {
    expect(codes(lecture([{ texteLu: 'Certifié KBDP', forme: 'ovale', confiance: 0.8 }]))).toEqual(['beth_din_paris']);
    expect(codes(lecture([{ texteLu: 'beth din de paris', forme: 'rectangle', confiance: 0.8 }]))).toEqual(['beth_din_paris']);
    expect(codes(lecture([{ texteLu: 'KLBD', forme: 'ovale', confiance: 0.8 }]))).toEqual(['klbd']);
    expect(codes(lecture([{ texteLu: 'London Beth Din', forme: 'texte', confiance: 0.8 }]))).toEqual(['klbd']);
    expect(codes(lecture([{ texteLu: 'NIK', forme: 'cercle', confiance: 0.8 }]))).toEqual(['rabbinat_hollande']);
    expect(codes(lecture([{ texteLu: 'Rabbinato di Milano', forme: 'texte avec étoile', confiance: 0.8 }]))).toEqual(['rabbinat_milan']);
    expect(codes(lecture([{ texteLu: 'בד"ץ העדה החרדית Badatz Eda Haredit', forme: 'rectangle hébreu', confiance: 0.7 }]))).toEqual(['badatz_eda_haredit']);
    expect(codes(lecture([{ texteLu: 'Star-K', forme: 'étoile', confiance: 0.8 }]))).toEqual(['star_k']);
    expect(codes(lecture([{ texteLu: 'KLBDX', forme: 'ovale', confiance: 0.8 }]))).toEqual([]);
  });
  it('un nom lu hors symbole (autres textes) compte, moins fort (0,6), jamais un sigle court', () => {
    const r = correspondreCertificateurs(lecture([], [], ['Sous le contrôle du Rav Wolff', 'Poids net 250 g', 'OU']), CERTIFICATEURS);
    expect(r.propositions).toEqual([{ code: 'rav_wolff', nom: 'Rav Wolff', nomCourt: 'Rav Wolff', confiance: 0.6, texteLu: 'Sous le contrôle du Rav Wolff', mentions: [] }]);
  });
  it('plusieurs symboles : une proposition par organisme, triées par confiance ; le candidat inconnu est rendu', () => {
    const r = correspondreCertificateurs(
      lecture([
        { texteLu: 'KBDP', forme: 'ovale', confiance: 0.7 },
        { texteLu: 'U', forme: 'cercle', confiance: 1 },
        { texteLu: 'U', forme: 'cercle', confiance: 0.5 },
        { texteLu: 'XYZ', forme: 'triangle', confiance: 0.9 },
      ]),
      CERTIFICATEURS,
    );
    expect(r.propositions.map((p) => [p.code, p.confiance])).toEqual([
      ['ou', 0.9],
      ['beth_din_paris', 0.7],
    ]);
    expect(r.candidatsNonReconnus).toEqual(['XYZ']);
    expect(r.aucun).toBe(false);
  });
  it('aucun candidat, ou aucun reconnu → aucun: true (ce n’est pas un « non cacher »)', () => {
    expect(correspondreCertificateurs(lecture([]), CERTIFICATEURS)).toMatchObject({ propositions: [], aucun: true });
    expect(correspondreCertificateurs(lecture([{ texteLu: 'Bio', forme: 'feuille', confiance: 1 }]), CERTIFICATEURS)).toMatchObject({ aucun: true, candidatsNonReconnus: ['Bio'] });
  });
  it('un certificateur absent du catalogue effectif (désactivé à la console) n’est jamais proposé', () => {
    const sansOu = CERTIFICATEURS.filter((c) => c.code !== 'ou');
    expect(codes(lecture([{ texteLu: 'U', forme: 'cercle', confiance: 1 }]), sansOu)).toEqual([]);
  });
  it('les mentions ne sont gardées que si l’organisme peut les porter ; la confiance est bornée à [0, 1]', () => {
    const r = correspondreCertificateurs(lecture([{ texteLu: 'Rav Wolff', forme: 'cartouche', confiance: 7 }], ['Pessah', 'Parve']), CERTIFICATEURS);
    expect(r.propositions[0]).toMatchObject({ code: 'rav_wolff', confiance: 1, mentions: ['parve'] });
  });
});

describe('lireMentions et formeCorrespond', () => {
  it('lit parvé, halavi, lait non surveillé, Pessah, mehadrin dans des textes libres', () => {
    expect(lireMentions(['PARVE'])).toEqual(['parve']);
    expect(lireMentions(['Dairy', 'D'])).toEqual(['halavi']);
    expect(lireMentions(['Chalav Yisrael'])).toEqual(['halavi']);
    expect(lireMentions(['lait non surveillé'])).toEqual(['lait_non_surveille']);
    expect(lireMentions(['Kosher for Passover', 'Mehadrin'])).toEqual(['pessah', 'mehadrin']);
    expect(lireMentions(['Poids net 250 g'])).toEqual([]);
  });
  it('rapproche les formes par leurs mots : cercle / rond / circle ; étoile / star ; kof / hébraïque', () => {
    expect(formeCorrespond('lettre U dans un cercle', 'la lettre U dans un cercle (le O)')).toBe(true);
    expect(formeCorrespond('U inside a circle', 'la lettre U dans un cercle')).toBe(true);
    expect(formeCorrespond('K in a star', 'la lettre K dans une étoile à cinq branches')).toBe(true);
    expect(formeCorrespond('K dans une étoile', 'la lettre K dans un cercle (le O)')).toBe(false);
    expect(formeCorrespond('', 'la lettre U dans un cercle')).toBe(false);
  });
});
