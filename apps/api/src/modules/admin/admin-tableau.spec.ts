import { describe, expect, it } from 'vitest';
import type { Database } from '../../database/client';
import { baseSimulee, nomTable, type Chaine } from '../../test/db-simulee';
import { AdminService, LIGNES_JOURNAL_IA } from './admin.service';

const COMPTES: Record<string, number> = { produit: 12, contribution: 3, signalement: 2, journal_ia: 7 };

function reponse(chaine: Chaine): unknown {
  const table = nomTable(chaine);
  if (chaine.some((c) => c.methode === 'offset')) return [{ id: 'j1', fournisseur: 'ovh', modele: 'whisper', usage: 'transcription', dureeMs: 500, jetonsEntree: null, jetonsSortie: null, ok: true, erreur: null, createdAt: new Date('2026-10-20T10:00:00Z') }];
  return [{ n: COMPTES[table] ?? 0 }];
}

/** Les instants cités dans une expression Drizzle (les paramètres de `gte`), sans sérialiser la table (circulaire). */
function dates(x: unknown, vus = new Set<unknown>()): Date[] {
  if (x instanceof Date) return [x];
  if (typeof x !== 'object' || x === null || vus.has(x)) return [];
  vus.add(x);
  const q = (x as { queryChunks?: unknown[]; value?: unknown }).queryChunks;
  if (Array.isArray(q)) return q.flatMap((c) => dates(c, vus));
  if ('value' in (x as object)) return dates((x as { value: unknown }).value, vus);
  return [];
}

describe('AdminService.tableau (des comptes, jamais une personne)', () => {
  it('rend les quatre comptes et le jour du centre ; « du jour » se compare à minuit à Paris', async () => {
    const { faux, db } = baseSimulee(reponse);
    const t = await new AdminService(faux as unknown as Database).tableau(new Date('2026-10-20T10:00:00Z'));
    expect(t).toEqual({ jour: '2026-10-20', produitsLus: 12, contributionsEnAttente: 3, signalementsOuverts: 2, lecturesIaDuJour: 7 });
    expect(Object.values(t).every((v) => typeof v === 'number' || v === '2026-10-20')).toBe(true);
    const lectures = db.find((c) => nomTable(c) === 'journal_ia')!;
    const where = lectures.find((c) => c.methode === 'where')!.args[0];
    expect(dates(where).map((d) => d.toISOString())).toEqual(['2026-10-19T22:00:00.000Z']);
  });
});

describe('AdminService.journalIa (lecture seule, 50 par page)', () => {
  it('page 1 par défaut, décalage (page − 1) × 50, total compté ; les lignes n’ont aucun contenu', async () => {
    const { faux, db } = baseSimulee(reponse);
    const page = await new AdminService(faux as unknown as Database).journalIa(3);
    expect(page).toMatchObject({ page: 3, parPage: LIGNES_JOURNAL_IA, total: 7 });
    expect(page.lignes[0]).toEqual({ id: 'j1', fournisseur: 'ovh', modele: 'whisper', usage: 'transcription', dureeMs: 500, jetonsEntree: null, jetonsSortie: null, ok: true, erreur: null, createdAt: '2026-10-20T10:00:00.000Z' });
    const lecture = db.find((c) => c.some((a) => a.methode === 'offset'))!;
    expect(lecture.find((a) => a.methode === 'limit')!.args).toEqual([50]);
    expect(lecture.find((a) => a.methode === 'offset')!.args).toEqual([100]);
    expect(LIGNES_JOURNAL_IA).toBe(50);
  });
});
