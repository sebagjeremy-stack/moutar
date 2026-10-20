import { Module } from '@nestjs/common';
import { AnalyseModule } from '../analyse/analyse.module';
import { CertificationModule } from '../certification/certification.module';
import { ListesModule } from '../listes/listes.module';
import { ProduitsModule } from '../produits/produits.module';
import { CarteController } from './carte.controller';
import { CarteService } from './carte.service';

@Module({ imports: [ProduitsModule, AnalyseModule, ListesModule, CertificationModule], controllers: [CarteController], providers: [CarteService] })
export class CarteModule {}
