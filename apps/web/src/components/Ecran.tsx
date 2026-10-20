import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconeRetour } from './Icones';

/** La page EST l'écran (430 px au plus) : barre haute, contenu, pied collant facultatif. */
export function Ecran({ barre, children, pied, className = '' }: { barre: ReactNode; children: ReactNode; pied?: ReactNode; className?: string }) {
  return (
    <div className={`ecran ${className}`}>
      <header className="barre">{barre}</header>
      <main className="contenu">{children}</main>
      {pied ? <footer className="pied">{pied}</footer> : null}
    </div>
  );
}

/** Le nom de l'application dans la barre (jeton `--app-name` de la maquette : ici, le texte). */
export function Marque({ centre = false }: { centre?: boolean }) {
  return <span className={`flex-1 text-18 font-bold tracking-[.01em] ${centre ? 'text-center' : ''}`}>Moutar</span>;
}

export function BoutonRetour({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="btn-icone" aria-label="Retour">
      <IconeRetour className="h-6 w-6" />
    </Link>
  );
}
