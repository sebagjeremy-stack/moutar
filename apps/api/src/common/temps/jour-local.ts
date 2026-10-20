/**
 * Le jour, c'est celui de la pendule du centre (Europe/Paris) — jamais `toISOString().slice(0, 10)` (le jour à
 * Greenwich : entre minuit et deux heures, la veille). Rend un jour ISO `AAAA-MM-JJ`, celui que la synthèse compare à
 * la validité d'une source (`regles/synthese.ts`).
 */
export const FUSEAU_DU_CENTRE = 'Europe/Paris';

const FORMATS = new Map<string, Intl.DateTimeFormat>();

function format(fuseau: string): Intl.DateTimeFormat {
  let f = FORMATS.get(fuseau);
  if (!f) {
    f = new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' });
    FORMATS.set(fuseau, f);
  }
  return f;
}

/** Le jour ISO d'un instant dans le fuseau du centre : `jourLocal(new Date('2026-10-31T23:30:00Z'))` → `2026-11-01`. */
export function jourLocal(instant: Date = new Date(), fuseau: string = FUSEAU_DU_CENTRE): string {
  const parts = format(fuseau).formatToParts(instant);
  const lire = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${lire('year')}-${lire('month')}-${lire('day')}`;
}

/**
 * Pure : vrai quand `AAAA-MM-JJ` est un jour RÉEL du calendrier (mois 1-12, jour dans le mois, années bissextiles) — sans
 * passer par `Date`, qui « corrige » le 2026-13-45 en silence et lit le fuseau.
 */
export function jourReel(jour: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour);
  if (!m) return false;
  const [annee, mois, j] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (annee < 1900 || mois < 1 || mois > 12 || j < 1) return false;
  const bissextile = (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
  const longueurs = [31, bissextile ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return j <= longueurs[mois - 1];
}

/**
 * L'instant où COMMENCE un jour `AAAA-MM-JJ` dans le fuseau du centre (minuit à Paris, soit 22 h ou 23 h UTC la veille) :
 * ce qu'une statistique « du jour » compare à `created_at`. Jamais `current_date` en SQL (le réglage de PostgreSQL).
 */
export function debutDuJour(jour: string, fuseau: string = FUSEAU_DU_CENTRE): Date {
  const base = new Date(`${jour}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(base);
  const lire = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((p) => p.type === type)?.value ?? '0');
  // À 00:00 UTC, la pendule du centre marque déjà `h` heures : minuit local était `h` heures plus tôt.
  return new Date(base.getTime() - (lire('hour') * 60 + lire('minute')) * 60_000);
}
