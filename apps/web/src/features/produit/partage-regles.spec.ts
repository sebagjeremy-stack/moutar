import { describe, expect, it } from 'vitest';
import type { CarteProduit } from '@moutar/shared-types';
import { resumeDePartage } from './partage-regles';

const carte = {
  produit: { id: 'p', ean: '3000000000001', nom: 'Petit Beurre', marque: 'Biscuiterie du Pré', imageUrl: null, ingredientsTexte: null, additifs: [], source: 'off', luLe: '2026-10-20T10:00:00Z' },
  seuil: 2,
  lignes: [
    { niveau: 1, statut: 'cite', pastille: 'Certifié · OU', ton: 'ok', source: 'Orthodox Union (OU)', detail: '', mention: 'parvé', publieLe: null, valableJusquAu: null, composition: null, avertissement: null },
    { niveau: 2, statut: 'non_cite', pastille: 'Non cité', ton: 'neutre', source: null, detail: '', mention: null, publieLe: null, valableJusquAu: null, composition: null, avertissement: null },
  ],
  synthese: { verdict: 'permis', ton: 'ok', pastille: 'Permis · OU · parvé', source: 'Orthodox Union (OU)', niveauFondateur: 1, phrase: 'Logo validé.', proposerScanIngredients: false },
  analyse: null,
} as unknown as CarteProduit;

describe('resumeDePartage (pure)', () => {
  it('titre « Moutar · nom », synthèse, une ligne par niveau avec sa source, adresse = l’EAN seul', () => {
    const r = resumeDePartage(carte);
    expect(r.titre).toBe('Moutar · Petit Beurre');
    expect(r.chemin).toBe('/produit/3000000000001');
    expect(r.texte).toContain('Petit Beurre · Biscuiterie du Pré');
    expect(r.texte).toContain('Permis · OU · parvé (seuil : niveau 2 · Liste officielle)');
    expect(r.texte).toContain('niveau 1 · Certifié : Certifié · OU — Orthodox Union (OU) (parvé)');
    expect(r.texte).toContain('niveau 2 · Liste officielle : Non cité');
    expect(r.texte).not.toMatch(/historique|téléphone/i);
  });
  it('sans EAN, pas d’adresse', () => {
    expect(resumeDePartage({ ...carte, produit: { ...carte.produit, ean: null } }).chemin).toBeNull();
  });
});
