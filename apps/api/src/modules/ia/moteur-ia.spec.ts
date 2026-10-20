import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';
import { ErreurIa, type FournisseurIa, type OptionsAppel, type ReponseIa } from './fournisseur-ia';
import type { EntreeJournalIa, JournalIa } from './journal-ia.service';
import { MoteurIa, creerFournisseur } from './moteur-ia';

const schema = z.object({ texte: z.string() });
const image = { octets: Buffer.from('img'), type: 'image/png' as const };
const consigne = { systeme: 's', utilisateur: 'u' };

class JournalMemoire implements JournalIa {
  lignes: EntreeJournalIa[] = [];
  async enregistrer(e: EntreeJournalIa): Promise<void> {
    this.lignes.push(e);
  }
}

/** Un fournisseur dont chaque appel suit un scénario : une valeur, ou une erreur à lancer. */
function fournisseur(scenarios: Array<ReponseIa<unknown> | ErreurIa | 'attendre'>): FournisseurIa {
  let i = 0;
  return {
    nom: 'ovh',
    modeleParDefaut: 'Qwen',
    async lireImage(_i, _c, s, options: OptionsAppel) {
      const etape = scenarios[i++];
      if (etape === 'attendre') {
        await new Promise<void>((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new ErreurIa('moteur_indisponible', 'délai', true))));
      }
      if (etape instanceof ErreurIa) throw etape;
      return { ...(etape as ReponseIa<unknown>), valeur: s.parse((etape as ReponseIa<unknown>).valeur) } as never;
    },
    async transcrire() {
      throw new ErreurIa('non_supporte', 'x');
    },
  };
}

const ok: ReponseIa<unknown> = { valeur: { texte: 'farine' }, modele: 'Qwen', jetonsEntree: 100, jetonsSortie: 10 };

async function erreurMetier(p: Promise<unknown>): Promise<{ statut: number; code: unknown }> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ErreurMetier);
    const err = e as ErreurMetier;
    return { statut: err.getStatus(), code: (err.getResponse() as { code: unknown }).code };
  }
  throw new Error('aucune erreur');
}

describe('MoteurIa : délai, relance, journal sans contenu', () => {
  it('un appel réussi : la valeur, et UNE ligne ok au journal avec fournisseur, modèle, usage, durée, jetons', async () => {
    const journal = new JournalMemoire();
    const m = new MoteurIa(fournisseur([ok]), journal);
    expect((await m.lireImage(image, consigne, schema, 'lecture_logo')).valeur).toEqual({ texte: 'farine' });
    expect(journal.lignes).toHaveLength(1);
    expect(journal.lignes[0]).toMatchObject({ fournisseur: 'ovh', modele: 'Qwen', usage: 'lecture_logo', ok: true, erreur: null, jetonsEntree: 100, jetonsSortie: 10 });
    expect(typeof journal.lignes[0].dureeMs).toBe('number');
    // Jamais le contenu : ni texte lu, ni image, ni consigne.
    expect(Object.keys(journal.lignes[0]).sort()).toEqual(['dureeMs', 'erreur', 'fournisseur', 'jetonsEntree', 'jetonsSortie', 'modele', 'ok', 'usage']);
  });
  it('un 5xx est relancé UNE fois, puis 503 moteur_indisponible ; deux lignes d’échec au journal', async () => {
    const journal = new JournalMemoire();
    const m = new MoteurIa(fournisseur([new ErreurIa('moteur_indisponible', '502', true), new ErreurIa('moteur_indisponible', '502', true), ok]), journal);
    expect(await erreurMetier(m.lireImage(image, consigne, schema, 'ocr_ingredients'))).toEqual({ statut: 503, code: 'moteur_indisponible' });
    expect(journal.lignes.map((l) => [l.ok, l.erreur, l.usage])).toEqual([
      [false, 'moteur_indisponible', 'ocr_ingredients'],
      [false, 'moteur_indisponible', 'ocr_ingredients'],
    ]);
  });
  it('un 5xx puis une réussite : la relance sauve l’appel ; une ligne échec puis une ligne ok', async () => {
    const journal = new JournalMemoire();
    const m = new MoteurIa(fournisseur([new ErreurIa('moteur_indisponible', 'réseau', true), ok]), journal);
    expect((await m.lireImage(image, consigne, schema, 'lecture_logo')).valeur).toEqual({ texte: 'farine' });
    expect(journal.lignes.map((l) => l.ok)).toEqual([false, true]);
  });
  it('une réponse illisible ne se relance pas : 502 reponse_illisible, une seule ligne ; une saturation → 429', async () => {
    const journal = new JournalMemoire();
    const m = new MoteurIa(fournisseur([new ErreurIa('reponse_illisible', 'pas de json'), ok]), journal);
    expect(await erreurMetier(m.lireImage(image, consigne, schema, 'lecture_logo'))).toEqual({ statut: 502, code: 'reponse_illisible' });
    expect(journal.lignes).toHaveLength(1);
    expect(journal.lignes[0]).toMatchObject({ ok: false, erreur: 'reponse_illisible' });
    expect(await erreurMetier(new MoteurIa(fournisseur([new ErreurIa('moteur_sature', 'x')]), journal).lireImage(image, consigne, schema, 'lecture_logo'))).toEqual({ statut: 429, code: 'moteur_sature' });
  });
  it('le délai : un fournisseur muet est interrompu par le signal, relancé une fois, puis 503', async () => {
    const journal = new JournalMemoire();
    const m = new MoteurIa(fournisseur(['attendre', 'attendre', ok]), journal, 30);
    const t0 = Date.now();
    expect(await erreurMetier(m.lireImage(image, consigne, schema, 'lecture_logo'))).toEqual({ statut: 503, code: 'moteur_indisponible' });
    expect(Date.now() - t0).toBeLessThan(2_000);
    expect(journal.lignes).toHaveLength(2);
  });
  it('sans fournisseur réglé : 503 moteur_non_configure, rien au journal', async () => {
    const journal = new JournalMemoire();
    const m = new MoteurIa(null, journal);
    expect(m.configure).toBe(false);
    expect(await erreurMetier(m.lireImage(image, consigne, schema, 'lecture_logo'))).toEqual({ statut: 503, code: 'moteur_non_configure' });
    expect(journal.lignes).toHaveLength(0);
  });
});

describe('creerFournisseur (environnement)', () => {
  const base = { IA_MODELE_ANTHROPIC: 'claude-opus-5-5', IA_API_KEY: undefined, IA_MODELE_VISION: 'Qwen2.5-VL-72B-Instruct', IA_MODELE_AUDIO: 'whisper-large-v3-turbo' };
  it('ovh sans IA_BASE_URL → null (moteur non configuré, l’API démarre)', () => {
    expect(creerFournisseur({ ...base, IA_FOURNISSEUR: 'ovh', ANTHROPIC_API_KEY: undefined, IA_BASE_URL: undefined })).toBeNull();
  });
  it('ovh avec IA_BASE_URL → le fournisseur OVH ; anthropic avec clé → Claude ; anthropic sans clé → refus clair', () => {
    expect(creerFournisseur({ ...base, IA_FOURNISSEUR: 'ovh', ANTHROPIC_API_KEY: undefined, IA_BASE_URL: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1' })?.nom).toBe('ovh');
    expect(creerFournisseur({ ...base, IA_FOURNISSEUR: 'anthropic', ANTHROPIC_API_KEY: 'sk-x', IA_BASE_URL: undefined })?.nom).toBe('anthropic');
    expect(() => creerFournisseur({ ...base, IA_FOURNISSEUR: 'anthropic', ANTHROPIC_API_KEY: undefined, IA_BASE_URL: undefined })).toThrow(/ANTHROPIC_API_KEY/);
  });
});
