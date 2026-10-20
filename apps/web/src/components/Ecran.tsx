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

/**
 * Le nom de l'application dans la barre (jeton `--app-name` de la maquette : ici, le texte) : police ronde, surligneur
 * soleil sous le nom, un point corail après (`.marque::after`) — la touche d'accent de la marque, décorative.
 */
export function Marque({ centre = false }: { centre?: boolean }) {
  return (
    <span className={`marque flex-1 ${centre ? 'justify-center' : ''}`}>
      <span className="marque-nom">Moutar</span>
    </span>
  );
}

export function BoutonRetour({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="btn-icone" aria-label="Retour">
      <IconeRetour className="h-6 w-6" />
    </Link>
  );
}
