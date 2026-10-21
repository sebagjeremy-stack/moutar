import { Module } from '@nestjs/common';
import { LimiteProduits } from './limite-produits';
import { ProduitsController } from './produits.controller';
import { ProduitsService } from './produits.service';

@Module({ controllers: [ProduitsController], providers: [ProduitsService, LimiteProduits], exports: [ProduitsService, LimiteProduits] })
export class ProduitsModule {}
