import { Module } from '@nestjs/common';
import { ProduitsModule } from '../produits/produits.module';
import { AnalyseController } from './analyse.controller';
import { AnalyseService } from './analyse.service';

@Module({ imports: [ProduitsModule], controllers: [AnalyseController], providers: [AnalyseService], exports: [AnalyseService] })
export class AnalyseModule {}
