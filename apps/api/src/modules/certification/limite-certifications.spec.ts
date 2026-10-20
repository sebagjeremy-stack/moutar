import { describe, expect, it } from 'vitest';
import { CERTIFICATIONS_PAR_HEURE, LimiteCertifications } from './limite-certifications';

describe('LimiteCertifications : 10 validations ou retraits par heure et par adresse', () => {
  it('le 11e geste d’une adresse → 429 trop_de_demandes ; une autre adresse n’est pas touchée', () => {
    const l = new LimiteCertifications();
    for (let i = 0; i < CERTIFICATIONS_PAR_HEURE; i++) l.exiger('10.0.0.1');
    expect(() => l.exiger('10.0.0.1')).toThrow(expect.objectContaining({ status: 429, response: expect.objectContaining({ code: 'trop_de_demandes' }) }));
    expect(() => l.exiger('10.0.0.2')).not.toThrow();
  });
});
