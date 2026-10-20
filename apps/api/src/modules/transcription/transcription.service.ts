import { Injectable } from '@nestjs/common';
import type { TranscriptionAudio } from '@moutar/shared-types';
import type { AudioIa } from '../ia/fournisseur-ia';
import { MoteurIa } from '../ia/moteur-ia';

/**
 * Lot 4 : la transcription de SECOURS d'une dictée (quand la Web Speech API du navigateur fait défaut). L'audio part au
 * moteur (`MoteurIa.transcrire` : OVH Whisper ; Claude → 501 `non_supporte`), le texte est RENDU pour relecture, jamais
 * enregistré ; l'audio n'est conservé nulle part ; le journal `journal_ia` reçoit une ligne `transcription` sans contenu.
 */
@Injectable()
export class TranscriptionService {
  constructor(private readonly moteur: MoteurIa) {}

  async transcrire(audio: AudioIa): Promise<TranscriptionAudio> {
    const r = await this.moteur.transcrire(audio);
    return { texte: r.valeur.texte, langue: r.valeur.langue, confiance: r.valeur.confiance };
  }
}
