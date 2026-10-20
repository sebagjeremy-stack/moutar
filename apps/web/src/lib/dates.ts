const JOUR = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** « 20/10/2026 ». */
export function formaterJour(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : JOUR.format(d);
}

/** Pure : « aujourd’hui », « hier », « lundi » (moins de 7 jours), sinon la date. */
export function quand(iso: string, maintenant: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const jour = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const ecart = Math.round((jour(maintenant) - jour(d)) / 86_400_000);
  if (ecart <= 0) return 'aujourd’hui';
  if (ecart === 1) return 'hier';
  if (ecart < 7) return new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(d);
  return JOUR.format(d);
}

/** « 01/07/2026 » depuis un JOUR `AAAA-MM-JJ` (une date de liste) : aucun fuseau n'entre en jeu, le jour s'écrit tel quel. */
export function formaterJourCivil(jour: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : formaterJour(jour);
}

/** Le jour d'aujourd'hui sur ce téléphone, `AAAA-MM-JJ` (jamais `toISOString().slice(0, 10)` : le jour à Greenwich). */
export function jourLocal(maintenant: Date = new Date()): string {
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${maintenant.getFullYear()}-${deux(maintenant.getMonth() + 1)}-${deux(maintenant.getDate())}`;
}

/** « 3 000 000 000 000 » : l'EAN par groupes de trois, lisible. */
export function formaterEan(ean: string | null): string {
  if (!ean) return '';
  return ean.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
