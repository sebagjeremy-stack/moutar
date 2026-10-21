import { Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import type { Produit } from '@moutar/shared-types';
import { LimiteProduits } from './limite-produits';
import { ProduitsService } from './produits.service';

/** Un EAN : 8 à 14 chiffres (EAN-8, EAN-13, GTIN-14). */
export const schemaEan = z.string().regex(/^\d{8,14}$/, 'EAN attendu : 8 à 14 chiffres');

/** Une liste d'ingrédients : 10 000 caractères au plus, partout (création, `PUT …/ingredients`, OCR, écran). */
export const INGREDIENTS_MAX = 10_000;

const videVersNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const schemaCreation = z.object({
  ean: z.preprocess(videVersNull, schemaEan.nullable().optional()),
  nom: z.string().trim().min(1).max(200),
  marque: z.preprocess(videVersNull, z.string().trim().max(200).nullable().optional()),
  ingredientsTexte: z.preprocess(videVersNull, z.string().trim().max(INGREDIENTS_MAX).nullable().optional()),
});
/** Lot 3 : `source: 'ocr'` quand le texte vient d'une photo relue par l'utilisateur (la fiche passe `source: 'ocr'`). */
const schemaIngredients = z.object({ ingredientsTexte: z.string().trim().min(1).max(INGREDIENTS_MAX), source: z.enum(['manuel', 'ocr']).default('manuel') });

@Controller('produits')
export class ProduitsController {
  constructor(
    private readonly produits: ProduitsService,
    private readonly limite: LimiteProduits,
  ) {}

  /** La fiche en cache n'est pas limitée ; seul l'appel à Open Food Facts pour un EAN inconnu l'est (60 / 10 min par adresse). */
  @Get(':ean')
  lire(@Param('ean') ean: string, @Req() req: Request): Promise<Produit> {
    const adresse = req.ip ?? 'inconnue';
    return this.produits.lireParEan(schemaEan.parse(ean), { avantAppelOff: () => this.limite.exigerLectureOff(adresse) });
  }

  /** 30 créations par heure et par adresse ; une requête refusée par zod ne compte pas. */
  @Post()
  creer(@Body() corps: unknown, @Req() req: Request): Promise<Produit> {
    const c = schemaCreation.parse(corps);
    this.limite.exigerCreation(req.ip ?? 'inconnue');
    return this.produits.creerManuel({ ean: c.ean ?? null, nom: c.nom, marque: c.marque ?? null, ingredientsTexte: c.ingredientsTexte ?? null });
  }

  /** 30 réécritures par heure et par adresse ; chacune laisse une ligne dans `journal_produit` (empreinte, jamais le texte). */
  @Put(':ean/ingredients')
  ingredients(@Param('ean') ean: string, @Body() corps: unknown, @Req() req: Request): Promise<Produit> {
    const c = schemaIngredients.parse(corps);
    const e = schemaEan.parse(ean);
    this.limite.exigerIngredients(req.ip ?? 'inconnue');
    return this.produits.mettreAJourIngredients(e, c.ingredientsTexte, c.source);
  }
}
