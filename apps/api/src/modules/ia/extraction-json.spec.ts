import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { extraireJson, interpreterJson } from './extraction-json';
import { ErreurIa } from './fournisseur-ia';

const schema = z.object({ texte: z.string(), confiance: z.number().min(0).max(1) });

describe('extraireJson / interpreterJson', () => {
  it('lit un objet nu, un bloc ```json, et un objet entouré de texte', () => {
    expect(extraireJson('{"a":1}')).toEqual({ a: 1 });
    expect(extraireJson('Voici :\n```json\n{"a": 2}\n```\nmerci')).toEqual({ a: 2 });
    expect(extraireJson('Réponse : {"a": {"b": 3}} fin.')).toEqual({ a: { b: 3 } });
  });
  it('rend null sans JSON, ou pour un tableau ou un nombre', () => {
    expect(extraireJson('aucun symbole visible')).toBeNull();
    expect(extraireJson('42')).toBeNull();
    expect(extraireJson('{"a": }')).toBeNull();
  });
  it('valide par le schéma : 502 reponse_illisible si le format est faux', () => {
    expect(interpreterJson('{"texte":"farine","confiance":0.9}', schema)).toEqual({ texte: 'farine', confiance: 0.9 });
    expect(() => interpreterJson('{"texte":"farine","confiance":"haute"}', schema)).toThrow(ErreurIa);
    try {
      interpreterJson('pas de json', schema);
    } catch (e) {
      expect((e as ErreurIa).code).toBe('reponse_illisible');
      expect((e as ErreurIa).relancable).toBe(false);
    }
  });
});
