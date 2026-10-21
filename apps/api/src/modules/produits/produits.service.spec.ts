import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../database/client';
import { baseSimulee, nomTable, valeurs, type Chaine } from '../../test/db-simulee';
import { empreinteTexte, ligneJournalProduit } from './journal-produit';

/*
 * Le service des produits SANS base ni réseau : Open Food Facts est simulé (`lireFicheOff`), la base enregistrée.
 * Ce qu'on vérifie (21/10/2026) : la trace `journal_produit` part DANS la transaction de l'écriture (empreinte, longueur,
 * jamais le texte) ; `avantAppelOff` n'est appelé que pour un EAN inconnu en base (une fiche en cache n'est pas limitée).
 */
const off = vi.hoisted(() => ({ lireFicheOff: vi.fn() }));
vi.mock('./off-client', () => ({ lireFicheOff: off.lireFicheOff }));
vi.mock('../../config/env', () => ({ loadEnv: () => ({ OFF_BASE_URL: 'https://off.test' }) }));

import { ProduitsService } from './produits.service';

const LIGNE = { id: 'p1', ean: '3000000000901', nom: 'Petit Beurre', marque: 'Lu', nomNorm: 'petit beurre', marqueNorm: 'lu', imageUrl: null, ingredientsTexte: null, additifs: [], source: 'manuel', luLe: new Date('2026-10-20T10:00:00Z'), createdAt: new Date(), updatedAt: new Date(), deletedAt: null };
const TEXTE = 'Sucre, huile de palme, émulsifiant : lécithine de soja (E322).';

describe('journal-produit (pur)', () => {
  it('empreinteTexte est le SHA-256 hexadécimal ; la ligne porte longueur et empreinte, jamais le texte ; un texte absent vaut vide', () => {
    expect(empreinteTexte(TEXTE)).toBe(createHash('sha256').update(TEXTE, 'utf8').digest('hex'));
    const ligne = ligneJournalProduit('p1', 'ingredients.ecriture', 'ocr', TEXTE);
    expect(ligne).toEqual({ produitId: 'p1', action: 'ingredients.ecriture', source: 'ocr', longueur: TEXTE.length, empreinte: empreinteTexte(TEXTE) });
    expect(JSON.stringify(ligne)).not.toContain('Sucre');
    expect(ligneJournalProduit('p1', 'produit.creation', 'manuel', null)).toMatchObject({ longueur: 0, empreinte: empreinteTexte('') });
  });
});

describe('ProduitsService.mettreAJourIngredients et creerManuel : la trace part dans la transaction', () => {
  beforeEach(() => off.lireFicheOff.mockReset());

  it('réécrire les ingrédients : UPDATE produit puis INSERT journal_produit (ingredients.ecriture, source ocr, empreinte) dans la même transaction', async () => {
    const { faux, db, tx } = baseSimulee(
      () => [LIGNE],
      (chaine: Chaine) => (nomTable(chaine) === 'produit' ? [{ ...LIGNE, ingredientsTexte: TEXTE, additifs: ['E322'], source: 'ocr' }] : []),
    );
    const service = new ProduitsService(faux as unknown as Database);
    const p = await service.mettreAJourIngredients('3000000000901', TEXTE, 'ocr');
    expect(p).toMatchObject({ id: 'p1', ingredientsTexte: TEXTE, source: 'ocr' });
    // Hors transaction : la seule lecture de la fiche. Dans la transaction : la mise à jour, puis la trace.
    expect(db.map(nomTable)).toEqual(['produit']);
    expect(tx.map((c) => `${c[0]?.methode} ${nomTable(c)}`)).toEqual(['update produit', 'insert journal_produit']);
    const trace = valeurs(tx[1]);
    expect(trace).toEqual({ produitId: 'p1', action: 'ingredients.ecriture', source: 'ocr', longueur: TEXTE.length, empreinte: empreinteTexte(TEXTE) });
    expect(JSON.stringify(trace)).not.toContain('Sucre');
  });

  it('créer à la main : INSERT produit puis INSERT journal_produit (produit.creation, source manuel) dans la transaction ; un EAN connu → 409 sans écriture', async () => {
    const { faux, tx } = baseSimulee(
      () => [],
      (chaine: Chaine) => (nomTable(chaine) === 'produit' ? [{ ...LIGNE, ingredientsTexte: TEXTE }] : []),
    );
    const service = new ProduitsService(faux as unknown as Database);
    await service.creerManuel({ ean: '3000000000901', nom: 'Petit Beurre', marque: 'Lu', ingredientsTexte: TEXTE });
    expect(tx.map((c) => `${c[0]?.methode} ${nomTable(c)}`)).toEqual(['insert produit', 'insert journal_produit']);
    expect(valeurs(tx[1])).toMatchObject({ produitId: 'p1', action: 'produit.creation', source: 'manuel', longueur: TEXTE.length });

    const existante = baseSimulee(() => [LIGNE]);
    await expect(new ProduitsService(existante.faux as unknown as Database).creerManuel({ ean: '3000000000901', nom: 'X', marque: null, ingredientsTexte: null })).rejects.toMatchObject({ status: 409 });
    expect(existante.tx).toEqual([]);
  });
});

describe('ProduitsService.lireParEan : avantAppelOff ne joue que pour un EAN inconnu en base', () => {
  beforeEach(() => off.lireFicheOff.mockReset());

  it('fiche en cache : rendue sans appel à OFF ni à avantAppelOff', async () => {
    const { faux } = baseSimulee(() => [LIGNE]);
    const avant = vi.fn();
    const p = await new ProduitsService(faux as unknown as Database).lireParEan('3000000000901', { avantAppelOff: avant });
    expect(p.id).toBe('p1');
    expect(avant).not.toHaveBeenCalled();
    expect(off.lireFicheOff).not.toHaveBeenCalled();
  });

  it('EAN inconnu : avantAppelOff est appelé AVANT OFF ; s’il lève (429), OFF n’est pas appelé et rien n’est écrit', async () => {
    const { faux, db } = baseSimulee(() => []);
    const ordre: string[] = [];
    off.lireFicheOff.mockImplementation(async () => {
      ordre.push('off');
      return { etat: 'inconnu' };
    });
    const service = new ProduitsService(faux as unknown as Database);
    await expect(service.lireParEan('3000000000902', { avantAppelOff: () => ordre.push('limite') })).rejects.toMatchObject({ status: 404 });
    expect(ordre).toEqual(['limite', 'off']);

    const refus = new Error('429');
    off.lireFicheOff.mockClear();
    await expect(service.lireParEan('3000000000903', { avantAppelOff: () => { throw refus; } })).rejects.toBe(refus);
    expect(off.lireFicheOff).not.toHaveBeenCalled();
    expect(db.filter((c) => c[0]?.methode === 'insert')).toEqual([]);
  });

  it('une fiche retirée répond 404 sans OFF ni avantAppelOff', async () => {
    const { faux } = baseSimulee(() => [{ ...LIGNE, deletedAt: new Date() }]);
    const avant = vi.fn();
    await expect(new ProduitsService(faux as unknown as Database).lireParEan('3000000000901', { avantAppelOff: avant })).rejects.toMatchObject({ status: 404 });
    expect(avant).not.toHaveBeenCalled();
    expect(off.lireFicheOff).not.toHaveBeenCalled();
  });
});
