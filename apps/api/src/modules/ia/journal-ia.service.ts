import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Database } from '../../database/client';
import { DRIZZLE } from '../../database/database.module';
import { journalIa } from '../../database/schema';
import type { NomFournisseur, UsageIa } from './fournisseur-ia';

/** Une ligne du journal : des nombres et des codes, JAMAIS le contenu (ni image, ni consigne, ni texte lu). */
export interface EntreeJournalIa {
  fournisseur: NomFournisseur;
  modele: string;
  usage: UsageIa;
  dureeMs: number;
  jetonsEntree: number | null;
  jetonsSortie: number | null;
  ok: boolean;
  erreur: string | null;
}

/** Ce que le moteur attend d'un journal (la base, ou une mémoire dans les tests). */
export interface JournalIa {
  enregistrer(e: EntreeJournalIa): Promise<void>;
}

/**
 * Journal des appels au moteur d'IA (`journal_ia`, ajout seul) : une ligne par tentative, réussie ou non. L'écriture est
 * attendue mais un journal en panne n'empêche pas une lecture : l'échec va au journal du serveur.
 */
@Injectable()
export class JournalIaService implements JournalIa {
  private readonly logger = new Logger('JournalIa');

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async enregistrer(e: EntreeJournalIa): Promise<void> {
    try {
      await this.db.insert(journalIa).values({ fournisseur: e.fournisseur, modele: e.modele, usage: e.usage, dureeMs: e.dureeMs, jetonsEntree: e.jetonsEntree, jetonsSortie: e.jetonsSortie, ok: e.ok, erreur: e.erreur });
    } catch (err) {
      this.logger.warn(`journal_ia : écriture impossible (${err instanceof Error ? err.message : String(err)})`);
    }
  }
}
