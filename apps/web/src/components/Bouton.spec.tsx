import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Bouton } from './Bouton';

describe('Bouton', () => {
  it('rend la classe de l’accent choisi (corail par défaut)', () => {
    render(<Bouton variante="accent">Photographier</Bouton>);
    expect(screen.getByRole('button', { name: 'Photographier' }).className).toContain('btn-accent-1');
  });
  it('rend la classe de l’accent demandé', () => {
    render(
      <Bouton variante="accent" accent={3}>
        Lagon
      </Bouton>,
    );
    const el = screen.getByRole('button', { name: 'Lagon' });
    expect(el.className).toContain('btn-accent-3');
    expect(el.className).not.toContain('btn-primaire');
  });
  it('ne pose aucun accent sur un bouton primaire', () => {
    render(<Bouton variante="primaire">Garder</Bouton>);
    const el = screen.getByRole('button', { name: 'Garder' });
    expect(el.className).toContain('btn-primaire');
    expect(el.className).not.toContain('btn-accent');
  });
});
