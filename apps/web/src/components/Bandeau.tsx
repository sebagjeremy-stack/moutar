import type { ReactNode } from 'react';

const CLASSE_TON = { warn: 'bandeau-warn', info: 'bandeau-info', danger: 'bandeau-danger' } as const;

/** Un bandeau : `warn` (ambre : non vérifié, attente, échec de lecture), `info`, `danger` (réservé). */
export function Bandeau({ ton, children, className = '', role = 'note' }: { ton: 'warn' | 'info' | 'danger'; children: ReactNode; className?: string; role?: 'note' | 'alert' | 'status' }) {
  return (
    <div className={`bandeau ${CLASSE_TON[ton]} ${className}`} role={role}>
      {children}
    </div>
  );
}
