import type { Ton } from '@moutar/shared-types';

/**
 * Une pastille porte TOUJOURS son mot : la couleur n'est qu'un renfort (jamais une information par la seule couleur).
 * Le rouge (`danger`) est réservé à « non cacher ».
 */
/** Les classes en toutes lettres : Tailwind ne conserve que les noms qu'il lit dans les sources. */
const CLASSE_TON: Record<Ton, string> = { ok: 'pastille-ok', warn: 'pastille-warn', danger: 'pastille-danger', neutre: 'pastille-neutre' };

export function Pastille({ ton, children, className = '' }: { ton: Ton; children: string; className?: string }) {
  if (!children.trim()) throw new Error('Une pastille porte toujours son mot.');
  return <span className={`pastille ${CLASSE_TON[ton]} ${className}`}>{children}</span>;
}
