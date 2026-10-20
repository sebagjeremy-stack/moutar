import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import type { Produit } from '@moutar/shared-types';
import { ProduitsService } from './produits.service';

/** Un EAN : 8 à 14 chiffres (EAN-8, EAN-13, GTIN-14). */
export const schemaEan = z.string().regex(/^\d{8,14}$/, 'EAN attendu : 8 à 14 chiffres');

const videVersNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const schemaCreation = z.object({
  ean: z.preprocess(videVersNull, schemaEan.nullable().optional()),
  nom: z.string().trim().min(1).max(200),
  marque: z.preprocess(videVersNull, z.string().trim().max(200).nullable().optional()),
  ingredientsTexte: z.preprocess(videVersNull, z.string().trim().max(5000).nullable().optional()),
});
const schemaIngredients = z.object({ ingredientsTexte: z.string().trim().min(1).max(5000) });

@Controller('produits')
export class ProduitsController {
  constructor(private readonly produits: ProduitsService) {}

  @Get(':ean')
  lire(@Param('ean') ean: string): Promise<Produit> {
    return this.produits.lireParEan(schemaEan.parse(ean));
  }

  @Post()
  creer(@Body() corps: unknown): Promise<Produit> {
    const c = schemaCreation.parse(corps);
    return this.produits.creerManuel({ ean: c.ean ?? null, nom: c.nom, marque: c.marque ?? null, ingredientsTexte: c.ingredientsTexte ?? null });
  }

  @Put(':ean/ingredients')
  ingredients(@Param('ean') ean: string, @Body() corps: unknown): Promise<Produit> {
    return this.produits.mettreAJourIngredients(schemaEan.parse(ean), schemaIngredients.parse(corps).ingredientsTexte);
  }
}
