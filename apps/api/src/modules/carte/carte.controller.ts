import { Controller, Get, Param, Query } from '@nestjs/common';
import type { CarteProduit } from '@moutar/shared-types';
import { lireSeuil } from '@moutar/shared-types/regles/niveaux';
import { schemaEan } from '../produits/produits.controller';
import { CarteService } from './carte.service';

@Controller('produits')
export class CarteController {
  constructor(private readonly carte: CarteService) {}

  @Get(':ean/carte')
  lire(@Param('ean') ean: string, @Query('seuil') seuil?: string): Promise<CarteProduit> {
    return this.carte.carte(schemaEan.parse(ean), lireSeuil(seuil));
  }
}
