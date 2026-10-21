import { describe, expect, it } from 'vitest';
import { ANALYSES_PAR_10_MIN, CREATIONS_PAR_HEURE, INGREDIENTS_PAR_HEURE, LECTURES_OFF_PAR_10_MIN, LimiteProduits } from './limite-produits';

const refus429 = expect.objectContaining({ status: 429, response: expect.objectContaining({ code: 'trop_de_demandes' }) });

describe('LimiteProduits : limites larges, par adresse, 429 trop_de_demandes', () => {
  it('la 31e création d’une adresse → 429 ; les autres gestes et une autre adresse ne sont pas touchés', () => {
    const l = new LimiteProduits();
    for (let i = 0; i < CREATIONS_PAR_HEURE; i++) l.exigerCreation('10.0.0.1');
    expect(() => l.exigerCreation('10.0.0.1')).toThrow(refus429);
    expect(() => l.exigerIngredients('10.0.0.1')).not.toThrow();
    expect(() => l.exigerAnalyse('10.0.0.1')).not.toThrow();
    expect(() => l.exigerLectureOff('10.0.0.1')).not.toThrow();
    expect(() => l.exigerCreation('10.0.0.2')).not.toThrow();
  });
  it('30 réécritures d’ingrédients par heure, 120 analyses et 60 lectures Open Food Facts par dix minutes', () => {
    const l = new LimiteProduits();
    for (let i = 0; i < INGREDIENTS_PAR_HEURE; i++) l.exigerIngredients('a');
    expect(() => l.exigerIngredients('a')).toThrow(refus429);
    for (let i = 0; i < ANALYSES_PAR_10_MIN; i++) l.exigerAnalyse('a');
    expect(() => l.exigerAnalyse('a')).toThrow(refus429);
    for (let i = 0; i < LECTURES_OFF_PAR_10_MIN; i++) l.exigerLectureOff('a');
    expect(() => l.exigerLectureOff('a')).toThrow(refus429);
    expect([CREATIONS_PAR_HEURE, INGREDIENTS_PAR_HEURE, ANALYSES_PAR_10_MIN, LECTURES_OFF_PAR_10_MIN]).toEqual([30, 30, 120, 60]);
  });
});
