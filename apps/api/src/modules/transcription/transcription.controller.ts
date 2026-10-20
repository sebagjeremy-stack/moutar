import { Controller, HttpCode, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import type { TranscriptionAudio } from '@moutar/shared-types';
import { audioRecu, type FichierAudio } from '../../common/validation/audio-recu';
import { TAILLE_MAX_AUDIO } from '../../common/validation/type-audio';
import { LimiteLectures } from '../ia/limite-lectures';
import { TranscriptionService } from './transcription.service';

/** Les limites de multer : 5 Mo (413 `fichier_trop_grand`), un fichier ; le type et la durée se lisent ensuite dans les octets. */
export const OPTIONS_AUDIO = { limits: { fileSize: TAILLE_MAX_AUDIO, files: 1 } };

/**
 * `POST /transcriptions` (multipart, champ `audio`) : publique, sans produit (rien du produit ne part au moteur), sous la
 * même limite que les lectures d'image (30 par 10 minutes et par adresse, 429 `trop_de_lectures`) ; un fichier refusé ne compte pas.
 */
@Controller('transcriptions')
export class TranscriptionController {
  constructor(
    private readonly transcription: TranscriptionService,
    private readonly limite: LimiteLectures,
  ) {}

  @Post()
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('audio', OPTIONS_AUDIO))
  transcrire(@Req() req: Request, @UploadedFile() audio?: FichierAudio): Promise<TranscriptionAudio> {
    const a = audioRecu(audio);
    this.limite.exiger(req.ip ?? 'inconnue');
    return this.transcription.transcrire(a);
  }
}
