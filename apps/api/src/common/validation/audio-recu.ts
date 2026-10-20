import { ErreurMetier } from '../erreurs/erreur-metier';
import type { AudioIa } from '../../modules/ia/fournisseur-ia';
import { DUREE_MAX_AUDIO_S, EXTENSION_AUDIO, dureeAudioSecondes, typeAudioReel } from './type-audio';

/** Ce que multer donne d'un fichier (sans dépendre de ses types). */
export interface FichierAudio {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * L'audio d'une requête multipart (champ `audio`) : absent → 400 `audio_absent` ; d'un conteneur que les octets ne
 * reconnaissent pas (MP3, AAC nu, texte…) → 415 `type_audio_refuse` ; plus de 30 s quand la durée se lit → 400
 * `audio_trop_long`. Le type annoncé par le navigateur n'est jamais lu ; le nom de fichier transmis au moteur est le nôtre.
 */
export function audioRecu(f: FichierAudio | undefined): AudioIa {
  if (!f || !f.buffer || f.size === 0) throw new ErreurMetier(400, 'audio_absent', 'Envoyez un enregistrement (champ « audio », WebM, Ogg, WAV ou MP4, 5 Mo et 30 s au plus).');
  const type = typeAudioReel(f.buffer);
  if (!type) throw new ErreurMetier(415, 'type_audio_refuse', 'Ce fichier n’est pas un audio WebM, Ogg, WAV ou MP4.');
  const duree = dureeAudioSecondes(f.buffer, type);
  if (duree !== null && duree > DUREE_MAX_AUDIO_S) {
    throw new ErreurMetier(400, 'audio_trop_long', `L’enregistrement dure ${Math.round(duree)} s : ${DUREE_MAX_AUDIO_S} s au plus.`, { dureeSecondes: Math.round(duree) });
  }
  return { octets: f.buffer, type, nomFichier: `dictee.${EXTENSION_AUDIO[type]}` };
}
