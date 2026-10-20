import { Logger, Module } from '@nestjs/common';
import { loadEnv } from '../../config/env';
import type { FournisseurIa } from './fournisseur-ia';
import { JournalIaService } from './journal-ia.service';
import { LimiteLectures } from './limite-lectures';
import { FOURNISSEUR_IA, MoteurIa, creerFournisseur } from './moteur-ia';

/** Le module `ia` unique : le fournisseur choisi par l'environnement, le moteur (délai, relance, journal), la limite des lectures. */
@Module({
  providers: [
    {
      provide: FOURNISSEUR_IA,
      useFactory: (): FournisseurIa | null => {
        const env = loadEnv();
        const f = creerFournisseur(env);
        const logger = new Logger('MoteurIa');
        if (f) logger.log(`Fournisseur d’IA : ${f.nom} (${f.nom === 'anthropic' ? env.IA_MODELE_ANTHROPIC : `${new URL(env.IA_BASE_URL!).hostname}, ${env.IA_MODELE_VISION}`}).`);
        else logger.warn('Aucun moteur d’IA réglé (IA_BASE_URL vide) : la lecture des photos répondra 503 moteur_non_configure.');
        return f;
      },
    },
    JournalIaService,
    { provide: MoteurIa, useFactory: (f: FournisseurIa | null, j: JournalIaService): MoteurIa => new MoteurIa(f, j), inject: [FOURNISSEUR_IA, JournalIaService] },
    LimiteLectures,
  ],
  exports: [MoteurIa, LimiteLectures],
})
export class IaModule {}
