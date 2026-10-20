import { createHash, randomBytes } from 'node:crypto';

export const COOKIE_ADMIN = 'moutar_admin';
export const DUREE_SESSION_MS = 12 * 60 * 60 * 1000;

/** Un jeton aléatoire de 32 octets (hex) ; seul son HACHÉ se garde en base. */
export function genererJeton(): string {
  return randomBytes(32).toString('hex');
}

export function hacherJeton(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}
