import type { Niveau } from '@moutar/shared-types';

/** Les classes en toutes lettres : Tailwind ne conserve que les noms qu'il lit dans les sources. */
const CLASSE_NIVEAU: Record<Niveau, string> = { 1: 'pastille-num-1', 2: 'pastille-num-2', 3: 'pastille-num-3', 4: 'pastille-num-4' };

/**
 * La pastille de NUMÉRO d'un niveau (1 corail, 2 soleil, 3 lagon, 4 lavande) : DÉCORATION seulement — le statut reste dans
 * la pastille sémantique à côté. Le chiffre coloré est caché aux lecteurs d'écran ; « Niveau N » leur est écrit à la place.
 */
export function PastilleNumero({ niveau, className = '' }: { niveau: Niveau; className?: string }) {
  return (
    <>
      <span className={`pastille-num ${CLASSE_NIVEAU[niveau]} ${className}`} aria-hidden="true">
        {niveau}
      </span>
      <span className="cache-visuel">Niveau {niveau}</span>
    </>
  );
}
