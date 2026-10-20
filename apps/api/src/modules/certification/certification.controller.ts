import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { z } from 'zod';
import type { CertificationProduit, ResultatLectureLogo } from '@moutar/shared-types';
import { MENTIONS_CERTIFICATION } from '@moutar/shared-types/catalogues/certificateurs';
import { imageRecue, type FichierImage } from '../../common/validation/image-recue';
import { TAILLE_MAX_IMAGE } from '../../common/validation/type-image';
import { LimiteLectures } from '../ia/limite-lectures';
import { schemaEan } from '../produits/produits.controller';
import { ProduitsService } from '../produits/produits.service';
import { CertificationService } from './certification.service';
import { LimiteCertifications } from './limite-certifications';

/** La validation d'un clic : le jeton rendu par la lecture, un code, des mentions, le texte lu (nettoyé et borné par le service). */
export const schemaValidation = z.object({
  jeton: z.string().trim().min(8).max(64),
  code: z.string().trim().min(1).max(50),
  mentions: z.array(z.enum(MENTIONS_CERTIFICATION as [string, ...string[]])).max(5).default([]),
  texteLu: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(1000).nullable().optional()),
});

/** Les limites de multer : 8 Mo (413 `fichier_trop_grand`), un fichier ; le type se lit ensuite dans les octets. */
export const OPTIONS_IMAGE = { limits: { fileSize: TAILLE_MAX_IMAGE, files: 1 } };

/** Lecture d'un logo SANS produit (« je photographie, Moutar me dit ce qu'il voit ») : des propositions, rien n'est écrit. */
@Controller('logos')
export class LogosController {
  constructor(
    private readonly certification: CertificationService,
    private readonly limite: LimiteLectures,
  ) {}

  @Post('lire')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('image', OPTIONS_IMAGE))
  lire(@Req() req: Request, @UploadedFile() image?: FichierImage): Promise<ResultatLectureLogo> {
    // L'image se vérifie d'abord (sans état), la limite ensuite : un fichier refusé ne compte pas.
    const img = imageRecue(image);
    this.limite.exiger(req.ip ?? 'inconnue');
    return this.certification.lireLogo(img, null);
  }
}

/** Le niveau 1 d'un produit : lecture du logo (propositions), validation d'un clic (verdict), retrait. */
@Controller('produits')
export class CertificationController {
  constructor(
    private readonly certification: CertificationService,
    private readonly produits: ProduitsService,
    private readonly limite: LimiteLectures,
    private readonly limiteEcritures: LimiteCertifications,
  ) {}

  @Post(':ean/logo')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('image', OPTIONS_IMAGE))
  async lireLogo(@Param('ean') ean: string, @Req() req: Request, @UploadedFile() image?: FichierImage): Promise<ResultatLectureLogo> {
    const img = imageRecue(image);
    const e = schemaEan.parse(ean);
    this.limite.exiger(req.ip ?? 'inconnue');
    // Le produit doit exister (404 sinon) ; ni son EAN ni son nom ne partent au moteur.
    await this.produits.lireParEan(e);
    return this.certification.lireLogo(img, e);
  }

  @Get(':ean/certification')
  lire(@Param('ean') ean: string): Promise<CertificationProduit | null> {
    return this.certification.lireParEan(schemaEan.parse(ean));
  }

  @Post(':ean/certification')
  valider(@Param('ean') ean: string, @Body() corps: unknown, @Req() req: Request): Promise<CertificationProduit> {
    const e = schemaEan.parse(ean);
    const v = schemaValidation.parse(corps ?? {});
    // Une requête refusée par zod ne compte pas ; 10 validations ou retraits par heure et par adresse.
    this.limiteEcritures.exiger(req.ip ?? 'inconnue');
    return this.certification.valider(e, { jeton: v.jeton, code: v.code, mentions: v.mentions as CertificationProduit['mentions'], texteLu: v.texteLu ?? null });
  }

  @Delete(':ean/certification')
  retirer(@Param('ean') ean: string, @Req() req: Request): Promise<{ ok: true }> {
    const e = schemaEan.parse(ean);
    this.limiteEcritures.exiger(req.ip ?? 'inconnue');
    return this.certification.retirer(e);
  }
}
