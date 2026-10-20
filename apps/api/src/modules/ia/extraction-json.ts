import type { z } from 'zod';
import { ErreurIa } from './fournisseur-ia';

/**
 * Pure : le premier objet JSON d'un texte rendu par un modèle (un bloc ``` ```json ``` est toléré, du texte autour aussi),
 * ou null. Le modèle ne reçoit jamais la confiance : ce qui en sort est validé par un schéma zod (`interpreterJson`).
 */
export function extraireJson(texte: string): unknown | null {
  const t = texte.trim();
  const candidats: string[] = [t];
  const bloc = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (bloc) candidats.unshift(bloc[1].trim());
  const debut = t.indexOf('{');
  const fin = t.lastIndexOf('}');
  if (debut !== -1 && fin > debut) candidats.push(t.slice(debut, fin + 1));
  for (const c of candidats) {
    try {
      const v: unknown = JSON.parse(c);
      if (typeof v === 'object' && v !== null) return v;
    } catch {
      // candidat suivant
    }
  }
  return null;
}

/** Le JSON d'une réponse, validé par le schéma ; sinon 502 `reponse_illisible` (jamais une valeur devinée). */
export function interpreterJson<T>(texte: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): T {
  const brut = extraireJson(texte);
  if (brut === null) throw new ErreurIa('reponse_illisible', 'Le moteur n’a pas rendu de JSON lisible.');
  const lu = schema.safeParse(brut);
  if (!lu.success) throw new ErreurIa('reponse_illisible', `La réponse du moteur ne respecte pas le format attendu (${lu.error.issues[0]?.path.join('.') || 'racine'}).`);
  return lu.data;
}
