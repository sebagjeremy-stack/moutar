import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { FiltreErreurs } from './common/erreurs/filtre-erreurs';
import { DatabaseModule } from './database/database.module';
import { AdminModule } from './modules/admin/admin.module';
import { AnalyseModule } from './modules/analyse/analyse.module';
import { CarteModule } from './modules/carte/carte.module';
import { ProduitsModule } from './modules/produits/produits.module';
import { SanteController } from './modules/sante/sante.controller';

@Module({
  imports: [DatabaseModule, ProduitsModule, AnalyseModule, CarteModule, AdminModule],
  controllers: [SanteController],
  providers: [{ provide: APP_FILTER, useClass: FiltreErreurs }],
})
export class AppModule {}
