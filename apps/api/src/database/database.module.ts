import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { loadEnv } from '../config/env';
import { creerDb, type Database, type DbBundle } from './client';

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
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(BUNDLE) private readonly bundle: DbBundle) {}
  async onModuleDestroy(): Promise<void> {
    await this.bundle.pool.end();
  }
}
