import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PastilleNumero } from './PastilleNumero';

describe('PastilleNumero', () => {
  it('rend le chiffre caché aux lecteurs d’écran, et le texte caché « Niveau 2 » à la place', () => {
    render(<PastilleNumero niveau={2} />);
    const chiffre = screen.getByText('2');
    expect(chiffre.getAttribute('aria-hidden')).toBe('true');
    expect(chiffre.className).toContain('pastille-num-2');
    const texte = screen.getByText('Niveau 2');
    expect(texte.className).toContain('cache-visuel');
    expect(texte.getAttribute('aria-hidden')).toBeNull();
  });
});
