/*
 * Le journal de la console (21/10/2026), règle PURE : le `detail` d'une ligne (un objet libre, écrit par le serveur) se lit
 * en entrées « clé : valeur » — les objets imbriqués sont aplatis (« produit.nom »), les listes jointes, six entrées au
 * plus puis « … » ; jamais du JSON brut à l'écran.
 */

export const ENTREES_DETAIL_MAX = 6;

/** La valeur d'une entrée, écrite pour l'écran : vide → « — », booléen → « oui » / « non », liste → jointe, sinon le texte. */
function valeurLisible(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'oui' : 'non';
  if (Array.isArray(v)) return v.length === 0 ? '—' : v.map(valeurLisible).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function aplatir(objet: Record<string, unknown>, prefixe: string, sortie: Array<[string, string]>): void {
  for (const [cle, v] of Object.entries(objet)) {
    const nom = prefixe ? `${prefixe}.${cle}` : cle;
    if (v && typeof v === 'object' && !Array.isArray(v)) aplatir(v as Record<string, unknown>, nom, sortie);
    else sortie.push([nom, valeurLisible(v)]);
  }
}

/** Pure : les entrées lisibles d'un `detail`, dans l'ordre, au plus `max` ; `tronque` dit s'il en reste. */
export function entreesDetail(detail: unknown, max = ENTREES_DETAIL_MAX): { entrees: Array<[string, string]>; tronque: boolean } {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return { entrees: [], tronque: false };
  const toutes: Array<[string, string]> = [];
  aplatir(detail as Record<string, unknown>, '', toutes);
  return { entrees: toutes.slice(0, max), tronque: toutes.length > max };
}
