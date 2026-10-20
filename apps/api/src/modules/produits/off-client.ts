import { normaliserCodeE } from '@moutar/shared-types/regles/niveaux';

/** Ce qu'on retient d'une fiche Open Food Facts (ODbL ; attribution affichée à l'écran). */
export interface FicheOff {
  ean: string;
  nom: string;
  marque: string | null;
  imageUrl: string | null;
  ingredientsTexte: string | null;
  additifs: string[];
}

export type ResultatOff = { etat: 'trouve'; fiche: FicheOff } | { etat: 'inconnu' } | { etat: 'indisponible'; raison: string };

const CHAMPS = 'product_name,product_name_fr,brands,image_front_url,ingredients_text_fr,ingredients_text,additives_tags';
export const USER_AGENT = 'Moutar/0.1 (usage familial)';

type Fetch = typeof fetch;

/**
 * Client Open Food Facts, pur hors de `fetch` (injectable pour les tests). Ne lève jamais : rend `indisponible` sur une
 * panne réseau ou une réponse inattendue — l'appelant répond alors 503, jamais un « aucun ».
 */
export async function lireFicheOff(baseUrl: string, ean: string, fetchImpl: Fetch = fetch, delaiMs = 8_000): Promise<ResultatOff> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v2/product/${encodeURIComponent(ean)}.json?fields=${CHAMPS}`;
  let reponse: Response;
  try {
    reponse = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(delaiMs) });
  } catch (e) {
    return { etat: 'indisponible', raison: e instanceof Error ? e.message : String(e) };
  }
  if (reponse.status === 404) return { etat: 'inconnu' };
  if (!reponse.ok) return { etat: 'indisponible', raison: `HTTP ${reponse.status}` };
  let corps: unknown;
  try {
    corps = await reponse.json();
  } catch {
    return { etat: 'indisponible', raison: 'réponse illisible' };
  }
  return interpreterReponseOff(ean, corps);
}

/** Pure : lit le JSON d'OFF (v2 : `status` 1/0 ou `status_verbose`). */
export function interpreterReponseOff(ean: string, corps: unknown): ResultatOff {
  if (typeof corps !== 'object' || corps === null) return { etat: 'indisponible', raison: 'réponse inattendue' };
  const c = corps as { status?: unknown; product?: Record<string, unknown> };
  if (c.status === 0 || !c.product) return { etat: 'inconnu' };
  const p = c.product;
  const texte = (k: string): string | null => (typeof p[k] === 'string' && (p[k] as string).trim() ? (p[k] as string).trim() : null);
  const nom = texte('product_name_fr') ?? texte('product_name');
  if (!nom) return { etat: 'inconnu' };
  const tags = Array.isArray(p['additives_tags']) ? (p['additives_tags'] as unknown[]).filter((t): t is string => typeof t === 'string') : [];
  // Un tag que le code ne sait pas lire (`en:e14xx`) est gardé tel quel : l'analyse le compte comme non lu, jamais tu.
  const additifs = [...new Set(tags.map((t) => normaliserCodeE(t) ?? t.trim()))];
  return {
    etat: 'trouve',
    fiche: { ean, nom, marque: texte('brands'), imageUrl: imageOff(texte('image_front_url')), ingredientsTexte: texte('ingredients_text_fr') ?? texte('ingredients_text'), additifs },
  };
}

/** Pure : l'image n'est gardée que servie en https par un hôte `*.openfoodfacts.org` ; sinon null (rien d'autre ne s'affiche à l'écran). */
export function imageOff(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return null;
    const hote = u.hostname.toLowerCase();
    return hote === 'openfoodfacts.org' || hote.endsWith('.openfoodfacts.org') ? url : null;
  } catch {
    return null;
  }
}
