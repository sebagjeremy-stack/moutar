import { Module } from '@nestjs/common';
import { ProduitsController } from './produits.controller';
import { ProduitsService } from './produits.service';

@Module({ controllers: [ProduitsController], providers: [ProduitsService], exports: [ProduitsService] })
export class ProduitsModule {}
