import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Un accent décoratif (1 corail, 2 soleil, 3 lagon, 4 lavande) : jamais un sens. */
export type Accent = 1 | 2 | 3 | 4;

/** `primaire` (lavande) ; `accent` : une teinte décorative choisie par `accent` (défaut : 1, corail — l'action chaleureuse). */
type Variante = 'defaut' | 'primaire' | 'accent';

/** Les classes en toutes lettres : Tailwind ne conserve que les noms qu'il lit dans les sources. */
const CLASSE_ACCENT: Record<Accent, string> = { 1: 'btn-accent-1', 2: 'btn-accent-2', 3: 'btn-accent-3', 4: 'btn-accent-4' };

function classes(variante: Variante, accent: Accent, grand: boolean, bloc: boolean, extra: string): string {
  return ['btn', variante === 'primaire' ? 'btn-primaire' : variante === 'accent' ? CLASSE_ACCENT[accent] : '', grand ? 'btn-grand' : '', bloc ? 'w-full' : '', extra].filter(Boolean).join(' ');
}

interface Commun {
  variante?: Variante;
  accent?: Accent;
  grand?: boolean;
  bloc?: boolean;
  className?: string;
  children: ReactNode;
}

/** Un bouton (48 px au moins ; pression `scale(.97)` par `.btn`). `aria-disabled` plutôt que `disabled` quand le bouton doit rester lisible et expliqué. */
export function Bouton({ variante = 'defaut', accent = 1, grand = false, bloc = false, className = '', children, ...rest }: Commun & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={classes(variante, accent, grand, bloc, className)} {...rest}>
      {children}
    </button>
  );
}

/** Un lien qui a l'air d'un bouton (navigation). */
export function BoutonLien({ to, variante = 'defaut', accent = 1, grand = false, bloc = false, className = '', children, ...rest }: Commun & { to: string; 'aria-label'?: string }) {
  return (
    <Link to={to} className={classes(variante, accent, grand, bloc, className)} {...rest}>
      {children}
    </Link>
  );
}
