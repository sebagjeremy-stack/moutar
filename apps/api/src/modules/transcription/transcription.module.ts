import { Module } from '@nestjs/common';
import { IaModule } from '../ia/ia.module';
import { TranscriptionController } from './transcription.controller';
import { TranscriptionService } from './transcription.service';

/** Lot 4 : la transcription de secours d'une dictée (`POST /transcriptions`), par le module `ia` unique. */
@Module({ imports: [IaModule], controllers: [TranscriptionController], providers: [TranscriptionService] })
export class TranscriptionModule {}
