import { Global, Inject, Logger, Module, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { loadEnv } from '../config/env';
import { creerDb, type Database, type DbBundle } from './client';
import { verifierRoleApplicatif } from './droits-application';

export const DRIZZLE = Symbol('DRIZZLE');
const BUNDLE = Symbol('DB_BUNDLE');

/** Module base de données, global : toute lecture/écriture passe par `DRIZZLE`. */
@Global()
@Module({
  providers: [
    { provide: BUNDLE, useFactory: (): DbBundle => creerDb(loadEnv().DATABASE_URL) },
    { provide: DRIZZLE, useFactory: (b: DbBundle): Database => b.db, inject: [BUNDLE] },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(BUNDLE) private readonly bundle: DbBundle) {}
  /**
   * En production, l'API refuse de servir avec un rôle qui n'est pas le rôle applicatif (superutilisateur, ou CREATE sur
   * le schéma) : la vérité relue en base, là où l'heuristique de `refusRoleProprietaire` ne voit pas le propriétaire
   * (le conteneur de l'API ne reçoit pas `DATABASE_URL_MIGRATIONS`). En développement, le propriétaire reste permis.
   */
  async onModuleInit(): Promise<void> {
    if (loadEnv().NODE_ENV !== 'production') return;
    const refus = await verifierRoleApplicatif(this.bundle.pool);
    if (refus) {
      new Logger('DatabaseModule').error(`Rôle de la base refusé en production : ${refus}`);
      throw new Error(`Rôle de la base refusé en production : ${refus}`);
    }
  }
  async onModuleDestroy(): Promise<void> {
    await this.bundle.pool.end();
  }
}
