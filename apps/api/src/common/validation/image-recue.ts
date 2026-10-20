import { ErreurMetier } from '../erreurs/erreur-metier';
import type { ImageIa } from '../../modules/ia/fournisseur-ia';
import { typeImageReel } from './type-image';

/** Ce que multer donne d'un fichier (sans dépendre de ses types). */
export interface FichierImage {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * L'image d'une requête multipart (champ `image`) : absente → 400 `image_absente` ; d'un type que les octets ne
 * reconnaissent pas (GIF, PDF, HEIC…) → 415 `type_image_refuse`. Le type annoncé par le navigateur n'est jamais lu.
 */
export function imageRecue(f: FichierImage | undefined): ImageIa {
  if (!f || !f.buffer || f.size === 0) throw new ErreurMetier(400, 'image_absente', 'Envoyez une photo (champ « image », JPEG, PNG ou WebP, 8 Mo au plus).');
  const type = typeImageReel(f.buffer);
  if (!type) throw new ErreurMetier(415, 'type_image_refuse', 'Ce fichier n’est pas une image JPEG, PNG ou WebP.');
  return { octets: f.buffer, type };
}
