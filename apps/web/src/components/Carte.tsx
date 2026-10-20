import type { HTMLAttributes, ReactNode } from 'react';

/** Une carte de l'écran (surface, bordure, rayon). */
export function Carte({ className = '', children, ...rest }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section className={`carte ${className}`} {...rest}>
      {children}
    </section>
  );
}

/** L'en-tête d'une carte : un titre, une action à droite. */
export function EnteteCarte({ id, titre, action }: { id: string; titre: string; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="mb-2 text-17 font-semibold">
        {titre}
      </h2>
      {action}
    </div>
  );
}
