import { describe, expect, it } from 'vitest';
import { tronquerEmail } from './admin.service';

describe('tronquerEmail (journal des connexions refusées)', () => {
  it('garde trois caractères et le domaine', () => {
    expect(tronquerEmail('admin@exemple.fr')).toBe('adm…@exemple.fr');
    expect(tronquerEmail('ab@exemple.fr')).toBe('ab…@exemple.fr');
    expect(tronquerEmail('sans-arobase')).toBe('san…@');
  });
});
