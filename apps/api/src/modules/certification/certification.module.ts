import { Module } from '@nestjs/common';
import { PropositionsEnAttente } from '../../common/auth/propositions-en-attente';
import { IaModule } from '../ia/ia.module';
import { ProduitsModule } from '../produits/produits.module';
import { CertificationController, LogosController } from './certification.controller';
import { CertificationService } from './certification.service';
import { LimiteCertifications } from './limite-certifications';

/** Lot 3, niveau 1 : lecture d'un logo (propositions + jeton), validation d'un clic, retrait ; lu par la carte. */
@Module({
  imports: [IaModule, ProduitsModule],
  controllers: [LogosController, CertificationController],
  providers: [CertificationService, LimiteCertifications, { provide: PropositionsEnAttente, useFactory: () => new PropositionsEnAttente() }],
  exports: [CertificationService],
})
export class CertificationModule {}
