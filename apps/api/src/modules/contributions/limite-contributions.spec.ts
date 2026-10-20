import { describe, expect, it } from 'vitest';
import { LimiteContributions, PROPOSITIONS_PAR_HEURE } from './limite-contributions';

describe('LimiteContributions : 10 contributions et 10 signalements par heure et par adresse', () => {
  it('la 11e contribution d’une adresse → 429 trop_de_demandes ; les signalements et une autre adresse ne sont pas touchés', () => {
    const l = new LimiteContributions();
    for (let i = 0; i < PROPOSITIONS_PAR_HEURE; i++) l.exigerContribution('10.0.0.1');
    expect(() => l.exigerContribution('10.0.0.1')).toThrow(expect.objectContaining({ status: 429, response: expect.objectContaining({ code: 'trop_de_demandes' }) }));
    expect(() => l.exigerSignalement('10.0.0.1')).not.toThrow();
    expect(() => l.exigerContribution('10.0.0.2')).not.toThrow();
  });
});
