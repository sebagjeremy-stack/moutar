/** Lit un cookie dans l'en-tête `Cookie`, sans dépendance. */
export function lireCookie(entete: string | undefined, nom: string): string | undefined {
  if (!entete) return undefined;
  for (const part of entete.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1 || part.slice(0, eq).trim() !== nom) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Les options d'un cookie posé par l'API : HttpOnly, SameSite=Lax, Secure hors développement. */
export function optionsCookie(production: boolean, maxAgeMs: number) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: production, path: '/', maxAge: maxAgeMs };
}
