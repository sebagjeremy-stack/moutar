import { describe, expect, it } from 'vitest';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';
import { LECTURES_PAR_FENETRE, LimiteLectures } from './limite-lectures';

describe('LimiteLectures : 30 lectures d’image par 10 minutes et par adresse', () => {
  it('la 31e lecture d’une adresse → 429 trop_de_lectures ; une autre adresse n’est pas touchée', () => {
    const l = new LimiteLectures();
    for (let i = 0; i < LECTURES_PAR_FENETRE; i++) l.exiger('10.0.0.1');
    let erreur: ErreurMetier | null = null;
    try {
      l.exiger('10.0.0.1');
    } catch (e) {
      erreur = e as ErreurMetier;
    }
    expect(erreur?.getStatus()).toBe(429);
    expect((erreur?.getResponse() as { code: string }).code).toBe('trop_de_lectures');
    expect(() => l.exiger('10.0.0.2')).not.toThrow();
  });
});
