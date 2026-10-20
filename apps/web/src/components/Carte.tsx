import type { HTMLAttributes, ReactNode } from 'react';
import { Emoji } from './Emoji';

/** Une carte de l'écran (surface, coins ronds, ombre colorée douce ; l'apparition échelonnée vient de `.contenu > *`). */
export function Carte({ className = '', children, ...rest }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section className={`carte ${className}`} {...rest}>
      {children}
    </section>
  );
}

/** L'en-tête d'une carte : un titre (police d'affichage), un emoji décoratif au plus, une action à droite. */
export function EnteteCarte({ id, titre, emoji, action }: { id: string; titre: string; emoji?: string; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="mb-2 text-18 font-bold">
        {titre}
        {emoji ? <Emoji>{emoji}</Emoji> : null}
      </h2>
      {action}
    </div>
  );
}
