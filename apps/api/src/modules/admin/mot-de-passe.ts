import bcrypt from 'bcryptjs';

/** bcrypt, coût 12 (pur JavaScript : aucun binaire à compiler). */
const COUT = 12;

export function hacherMotDePasse(motDePasse: string): Promise<string> {
  return bcrypt.hash(motDePasse, COUT);
}

export function verifierMotDePasse(motDePasse: string, hash: string): Promise<boolean> {
  return bcrypt.compare(motDePasse, hash);
}

/** Un hash « leurre », comparé quand le compte n'existe pas : la réponse prend le même temps. */
export const HASH_LEURRE = bcrypt.hashSync('leurre-sans-valeur', COUT);
