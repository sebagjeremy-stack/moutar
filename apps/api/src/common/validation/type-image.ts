/**
 * Le type RÉEL d'une image reçue, lu dans ses OCTETS (nombres magiques), jamais dans l'extension ni dans le type annoncé
 * par le navigateur : seuls JPEG, PNG et WebP entrent (ce que les deux moteurs de vision acceptent). Une image pèse
 * 8 Mo au plus (`TAILLE_MAX_IMAGE`) ; aucune recompression (lot 3).
 */
export type TypeImage = 'image/jpeg' | 'image/png' | 'image/webp';

export const TYPES_IMAGE: readonly TypeImage[] = ['image/jpeg', 'image/png', 'image/webp'];

export const TAILLE_MAX_IMAGE = 8 * 1024 * 1024;

/** Le type d'une image d'après ses premiers octets, ou null si ce n'est ni un JPEG, ni un PNG, ni un WebP. */
export function typeImageReel(octets: Buffer): TypeImage | null {
  if (octets.length < 12) return null;
  if (octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff) return 'image/jpeg';
  if (octets.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (octets.subarray(0, 4).toString('latin1') === 'RIFF' && octets.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}
