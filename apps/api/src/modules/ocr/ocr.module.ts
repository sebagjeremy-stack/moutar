import { Module } from '@nestjs/common';
import { IaModule } from '../ia/ia.module';
import { ProduitsModule } from '../produits/produits.module';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';

/** Lot 3 : OCR d'une liste d'ingrédients (transcription rendue, relue et validée par l'utilisateur avant écriture). */
@Module({ imports: [IaModule, ProduitsModule], controllers: [OcrController], providers: [OcrService] })
export class OcrModule {}
