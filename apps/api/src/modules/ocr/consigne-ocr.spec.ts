import { describe, expect, it } from 'vitest';
import { interpreterJson } from '../ia/extraction-json';
import { schemaReponseOcr, TEXTE_OCR_MAX } from './consigne-ocr';

describe('schemaReponseOcr : tronque, ne refuse pas (relecture des lots 3-5)', () => {
  it('un texte de 20 000 caractères est coupé à 10 000, une confiance 7 vaut 1, une langue longue est coupée à 10', () => {
    const lu = schemaReponseOcr.parse({ texte: 'x'.repeat(20_000), langue: ' FR-FR-FR-FR-FR ', lisible: true, confiance: 7 });
    expect(lu.texte).toHaveLength(TEXTE_OCR_MAX);
    expect(lu.confiance).toBe(1);
    expect(lu.langue).toBe('fr-fr-fr-f');
  });
  it('une confiance absente ou non numérique vaut 0 ; « lisible » absent vaut vrai, « false » en chaîne vaut faux', () => {
    expect(schemaReponseOcr.parse({ texte: 'sucre' })).toEqual({ texte: 'sucre', langue: null, lisible: true, confiance: 0 });
    expect(schemaReponseOcr.parse({ texte: '', lisible: 'false', confiance: 'nan' })).toMatchObject({ lisible: false, confiance: 0 });
  });
  it('seule l’absence de texte reste un refus (502 reponse_illisible)', () => {
    expect(() => schemaReponseOcr.parse({ langue: 'fr', lisible: true, confiance: 1 })).toThrow();
    expect(() => interpreterJson('{"texte": 12}', schemaReponseOcr)).toThrow(expect.objectContaining({ code: 'reponse_illisible' }));
  });
});
