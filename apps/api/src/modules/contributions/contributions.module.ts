import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { ProduitsModule } from '../produits/produits.module';
import { ContributionsAdminController } from './contributions-admin.controller';
import { ContributionsController } from './contributions.controller';
import { ContributionsService } from './contributions.service';
import { LimiteContributions } from './limite-contributions';
import { SignalementsService } from './signalements.service';

/** Lot 5 : contributions communautaires (niveau 3) et signalements — routes publiques, console ; lu par la carte. */
@Module({
  imports: [ProduitsModule, AdminModule],
  controllers: [ContributionsController, ContributionsAdminController],
  providers: [ContributionsService, SignalementsService, LimiteContributions],
  exports: [ContributionsService],
})
export class ContributionsModule {}
