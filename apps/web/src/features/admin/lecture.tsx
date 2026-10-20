import { useCallback, useEffect, useState } from 'react';
import { Bandeau } from '../../components/Bandeau';
import { Bouton } from '../../components/Bouton';
import { Pastille } from '../../components/Pastille';
import { lire } from '../../lib/api';
import { phraseErreur } from '../../lib/erreurs';

/** Une lecture de la console : en chargement, lue, ou en échec (jamais « aucun » tant qu'elle n'est pas lue). */
export type Chargement<T> = { phase: 'chargement' } | { phase: 'ok'; data: T } | { phase: 'echec'; message: string };

export function useLecture<T>(url: string, surRefus: (statut: number) => void) {
  const [etat, setEtat] = useState<Chargement<T>>({ phase: 'chargement' });
  const charger = useCallback(async () => {
    setEtat({ phase: 'chargement' });
    const r = await lire<T>(url);
    if (r.ok) setEtat({ phase: 'ok', data: r.data });
    else {
      surRefus(r.statut);
      setEtat({ phase: 'echec', message: phraseErreur(r) });
    }
  }, [url, surRefus]);
  useEffect(() => {
    void charger();
  }, [charger]);
  return { etat, charger, setEtat };
}

export function EtatNonLu({ etat, recharger }: { etat: { phase: 'chargement' } | { phase: 'echec'; message: string }; recharger: () => void }) {
  if (etat.phase === 'chargement')
    return (
      <p className="muet" role="status">
        Lecture…
      </p>
    );
  return (
    <Bandeau ton="warn" role="alert" className="flex flex-wrap items-center gap-3">
      <Pastille ton="warn">Non lu</Pastille>
      <span className="flex-1">{etat.message}</span>
      <Bouton className="min-h-[40px]" onClick={recharger}>
        Réessayer
      </Bouton>
    </Bandeau>
  );
}
