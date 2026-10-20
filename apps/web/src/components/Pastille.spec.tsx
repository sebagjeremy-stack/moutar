import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Pastille } from './Pastille';

describe('Pastille', () => {
  it('rend le mot, avec la classe du ton', () => {
    render(<Pastille ton="warn">Non vérifié</Pastille>);
    const el = screen.getByText('Non vérifié');
    expect(el.className).toContain('pastille-warn');
  });
  it('refuse une pastille sans mot', () => {
    // React écrit l'erreur attendue sur la console : on la tait le temps du test.
    const silence = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Pastille ton="ok">{'  '}</Pastille>)).toThrow();
    silence.mockRestore();
  });
});
