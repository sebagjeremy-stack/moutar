import { Injectable } from '@nestjs/common';
import type { TranscriptionOcr } from '@moutar/shared-types';
import type { ImageIa } from '../ia/fournisseur-ia';
import { MoteurIa } from '../ia/moteur-ia';
import { CONSIGNE_OCR, schemaReponseOcr } from './consigne-ocr';
import { nettoyerOcr } from './nettoyage-ocr';

/** L'OCR d'une liste d'ingrédients : la transcription est RENDUE, jamais enregistrée ici (l'utilisateur relit, puis `PUT …/ingredients`). */
@Injectable()
export class OcrService {
  constructor(private readonly moteur: MoteurIa) {}

  async transcrire(image: ImageIa): Promise<TranscriptionOcr> {
    const r = await this.moteur.lireImage(image, CONSIGNE_OCR, schemaReponseOcr, 'ocr_ingredients');
    const texteBrut = r.valeur.texte.trim();
    const texte = nettoyerOcr(texteBrut);
    return { texte, texteBrut, langue: r.valeur.langue, lisible: r.valeur.lisible && texte.length > 0, confiance: r.valeur.confiance };
  }
}
