import { describe, expect, it } from 'vitest';
import { interpreterJson } from '../ia/extraction-json';
import { schemaLectureLogo } from './consigne-logo';

describe('schemaLectureLogo : tronque, ne refuse pas (relecture des lots 3-5)', () => {
  it('un texte de 1 000 caractères est coupé à 300, une confiance 7 vaut 1, 60 candidats deviennent 20 — jamais 502', () => {
    const brut = { candidats: Array.from({ length: 60 }, (_, i) => ({ texteLu: `U${i}`, forme: 'cercle', confiance: 7 })), mentions: ['PARVE'], autresTextes: ['x'.repeat(1000)] };
    const lu = schemaLectureLogo.parse(brut);
    expect(lu.candidats).toHaveLength(20);
    expect(lu.candidats[0]).toEqual({ texteLu: 'U0', forme: 'cercle', confiance: 1 });
    expect(lu.autresTextes[0]).toHaveLength(300);
    expect(() => interpreterJson(JSON.stringify(brut), schemaLectureLogo)).not.toThrow();
  });
  it('une confiance négative vaut 0, une confiance non numérique vaut 0, une chaîne numérique se lit', () => {
    const lu = schemaLectureLogo.parse({ candidats: [{ texteLu: 'K', forme: 'étoile', confiance: -2 }, { texteLu: 'K', forme: 'étoile', confiance: 'haute' }, { texteLu: 'K', forme: 'étoile', confiance: '0.4' }] });
    expect(lu.candidats.map((c) => c.confiance)).toEqual([0, 0, 0.4]);
  });
  it('les entrées qui ne sont pas des chaînes sont écartées ; forme et texteLu absents valent « » ; mentions et autresTextes absents valent []', () => {
    const lu = schemaLectureLogo.parse({ candidats: [{ confiance: 0.5 }, 'pas un objet', null], mentions: ['D', 42, null], autresTextes: 'pas une liste' });
    expect(lu.candidats).toEqual([{ texteLu: '', forme: '', confiance: 0.5 }]);
    expect(lu.mentions).toEqual(['D']);
    expect(lu.autresTextes).toEqual([]);
  });
  it('seule l’absence de candidats reste un refus (502 reponse_illisible)', () => {
    expect(() => schemaLectureLogo.parse({ mentions: [] })).toThrow();
    expect(() => interpreterJson('{"mentions":[]}', schemaLectureLogo)).toThrow(expect.objectContaining({ code: 'reponse_illisible' }));
    expect(() => schemaLectureLogo.parse({ candidats: 'U' })).toThrow();
  });
});
