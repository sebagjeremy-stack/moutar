import { Module } from '@nestjs/common';
import { IaModule } from '../ia/ia.module';
import { ProduitsModule } from '../produits/produits.module';
import { CertificationController, LogosController } from './certification.controller';
import { CertificationService } from './certification.service';

/** Lot 3, niveau 1 : lecture d'un logo (propositions), validation d'un clic, retrait ; lu par la carte. */
@Module({ imports: [IaModule, ProduitsModule], controllers: [LogosController, CertificationController], providers: [CertificationService], exports: [CertificationService] })
export class CertificationModule {}
