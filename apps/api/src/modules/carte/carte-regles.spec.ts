import { describe, expect, it } from 'vitest';
import type { Produit } from '@moutar/shared-types';
import { analyserComposition } from '../analyse/analyse-composition-regles';
import { ligneCertifie, ligneComposition, ligneListeOfficielle } from './carte-regles';

const p: Produit = { id: 'x', ean: '1', nom: 'Test', marque: null, imageUrl: null, ingredientsTexte: null, additifs: [], source: 'off', luLe: '2026-10-20T10:00:00Z' };

describe('lignes de la carte (lot 1)', () => {
  it('les niveaux 1 à 3 ne disent jamais « non »', () => {
    expect(ligneCertifie().statut).toBe('non_verifie');
    expect(ligneListeOfficielle().ton).toBe('warn');
    expect(ligneListeOfficielle().pastille).toBe('Non vérifié');
  });
  it('le niveau 4 n’est jamais vert et porte son avertissement', () => {
    const ok = ligneComposition(p, analyserComposition({ ingredientsTexte: 'farine, E322', additifsTags: [] }), new Date('2026-10-20T10:00:00Z'));
    expect(ok.ton).toBe('neutre');
    expect(ok.pastille).toContain('composition seule');
    expect(ok.avertissement).toMatch(/bichoul/);
    expect(ok.detail).toContain('lue le 20/10/2026');
    const non = ligneComposition(p, analyserComposition({ ingredientsTexte: 'gélatine', additifsTags: [] }), new Date());
    expect(non.ton).toBe('danger');
    expect(non.statut).toBe('non_casher');
  });
  it('sans ingrédients : « Ingrédients inconnus », ambre, sans avertissement', () => {
    const l = ligneComposition(p, null, new Date());
    expect(l.pastille).toBe('Ingrédients inconnus');
    expect(l.composition).toBeNull();
  });
});
