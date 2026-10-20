import { describe, expect, it } from 'vitest';
import { mentionsContradictoires } from './certification-regles';

describe('mentionsContradictoires (parvé / halavi / lait non surveillé : une seule)', () => {
  it('parvé + halavi, parvé + lait non surveillé, halavi + lait non surveillé se contredisent', () => {
    expect(mentionsContradictoires(['parve', 'halavi'])).toBe(true);
    expect(mentionsContradictoires(['parve', 'lait_non_surveille'])).toBe(true);
    expect(mentionsContradictoires(['halavi', 'lait_non_surveille', 'pessah'])).toBe(true);
  });
  it('une seule mention laitière, avec Pessah ou mehadrin, ou aucune : pas de contradiction', () => {
    expect(mentionsContradictoires(['parve', 'pessah', 'mehadrin'])).toBe(false);
    expect(mentionsContradictoires(['halavi', 'halavi'])).toBe(false);
    expect(mentionsContradictoires([])).toBe(false);
  });
});
