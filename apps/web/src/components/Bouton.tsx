import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Variante = 'defaut' | 'primaire';

function classes(variante: Variante, grand: boolean, bloc: boolean, extra: string): string {
  return ['btn', variante === 'primaire' ? 'btn-primaire' : '', grand ? 'btn-grand' : '', bloc ? 'w-full' : '', extra].filter(Boolean).join(' ');
}

interface Commun {
  variante?: Variante;
  grand?: boolean;
  bloc?: boolean;
  className?: string;
  children: ReactNode;
}

/** Un bouton (48 px au moins). `aria-disabled` plutôt que `disabled` quand le bouton doit rester lisible et expliqué. */
export function Bouton({ variante = 'defaut', grand = false, bloc = false, className = '', children, ...rest }: Commun & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={classes(variante, grand, bloc, className)} {...rest}>
      {children}
    </button>
  );
}

/** Un lien qui a l'air d'un bouton (navigation). */
export function BoutonLien({ to, variante = 'defaut', grand = false, bloc = false, className = '', children, ...rest }: Commun & { to: string; 'aria-label'?: string }) {
  return (
    <Link to={to} className={classes(variante, grand, bloc, className)} {...rest}>
      {children}
    </Link>
  );
}
