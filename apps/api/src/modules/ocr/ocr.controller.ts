import { Controller, HttpCode, Param, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import type { TranscriptionOcr } from '@moutar/shared-types';
import { imageRecue, type FichierImage } from '../../common/validation/image-recue';
import { OPTIONS_IMAGE } from '../certification/certification.controller';
import { LimiteLectures } from '../ia/limite-lectures';
import { schemaEan } from '../produits/produits.controller';
import { ProduitsService } from '../produits/produits.service';
import { OcrService } from './ocr.service';

/** `POST /produits/:ean/ingredients/ocr` (multipart `image`) : la transcription nettoyée, SANS écriture — d'où le 200, pas un 201. */
@Controller('produits')
export class OcrController {
  constructor(
    private readonly ocr: OcrService,
    private readonly produits: ProduitsService,
    private readonly limite: LimiteLectures,
  ) {}

  @Post(':ean/ingredients/ocr')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('image', OPTIONS_IMAGE))
  async transcrire(@Param('ean') ean: string, @Req() req: Request, @UploadedFile() image?: FichierImage): Promise<TranscriptionOcr> {
    const img = imageRecue(image);
    this.limite.exiger(req.ip ?? 'inconnue');
    await this.produits.lireParEan(schemaEan.parse(ean));
    return this.ocr.transcrire(img);
  }
}
