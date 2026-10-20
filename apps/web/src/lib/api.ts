/**
 * L'appel à l'API : ne lève jamais sur une réponse HTTP. Un échec rend `{ ok: false, code, message, statut }` ; une panne
 * réseau rend `code: 'reseau'`. L'écran n'écrit jamais « aucun » sur un échec : il dit « non lu » et propose « Réessayer ».
 */
export type Reponse<T> = { ok: true; data: T } | { ok: false; statut: number; code: string; message: string; extra: Record<string, unknown> };

export async function appel<T>(url: string, init: RequestInit = {}): Promise<Reponse<T>> {
  let r: Response;
  try {
    r = await fetch(url, { credentials: 'same-origin', ...init, headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) } });
  } catch {
    return { ok: false, statut: 0, code: 'reseau', message: 'Pas de réseau : la demande n’est pas partie.', extra: {} };
  }
  const texte = await r.text();
  let corps: unknown = null;
  if (texte) {
    try {
      corps = JSON.parse(texte);
    } catch {
      corps = null;
    }
  }
  if (r.ok) return { ok: true, data: corps as T };
  const c = (typeof corps === 'object' && corps !== null ? corps : {}) as Record<string, unknown>;
  return {
    ok: false,
    statut: r.status,
    code: typeof c['code'] === 'string' ? c['code'] : 'erreur',
    message: typeof c['message'] === 'string' ? c['message'] : `Erreur ${r.status}.`,
    extra: c,
  };
}

export const lire = <T>(url: string) => appel<T>(url);
export const envoyer = <T>(url: string, corps: unknown, methode: 'POST' | 'PUT' = 'POST') => appel<T>(url, { method: methode, body: JSON.stringify(corps) });
