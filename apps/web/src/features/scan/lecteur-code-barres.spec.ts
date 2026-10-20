import { describe, expect, it } from 'vitest';
import { normaliserCodeLu } from './lecteur-code-barres';

describe('normaliserCodeLu', () => {
  it('accepte EAN-13, EAN-8, complète un UPC-A, refuse le reste', () => {
    expect(normaliserCodeLu('3017620422003')).toBe('3017620422003');
    expect(normaliserCodeLu('12345678')).toBe('12345678');
    expect(normaliserCodeLu('012345678905')).toBe('0012345678905');
    expect(normaliserCodeLu('abc')).toBeNull();
    expect(normaliserCodeLu('123')).toBeNull();
  });
});
