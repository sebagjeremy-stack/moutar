import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { ListesAdminController } from './listes.controller';
import { ListesService } from './listes.service';

/** Lot 2 : listes officielles (import à la console, lignes, listes actives pour la carte et la recherche). */
@Module({ imports: [AdminModule], controllers: [ListesAdminController], providers: [ListesService], exports: [ListesService] })
export class ListesModule {}
