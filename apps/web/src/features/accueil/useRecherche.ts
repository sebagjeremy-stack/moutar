import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResultatRecherche } from '@moutar/shared-types';
import { appel } from '../../lib/api';
import { phraseErreur } from '../../lib/erreurs';

/**
 * La recherche de l'accueil (lot 2) : dès 3 caractères, `GET /recherche?q=` après 300 ms sans frappe ; la requête
 * précédente est ANNULÉE quand une nouvelle part (un seul appel en vol) ; 13 chiffres → la fiche du produit, sans appel.
 * Rien n'est gardé sur le téléphone (ni la saisie, ni les résultats).
 */
export const DELAI_RECHERCHE = 300;
export const MIN_CARACTERES = 3;

export type EtatRecherche =
  /** Moins de 3 caractères : rien à montrer. */
  | { phase: 'repos' }
  | { phase: 'recherche' }
  | { phase: 'resultats'; q: string; resultat: ResultatRecherche }
  /** Une réponse SANS résultat (jamais pendant le chargement ni sur un échec). */
  | { phase: 'vide'; q: string }
  | { phase: 'echec'; q: string; message: string };

/** Un code-barres tapé en entier : 13 chiffres (espaces tolérés) → l'EAN, sinon null. */
export function estCodeBarres(saisie: string): string | null {
  const brut = saisie.replace(/\s/g, '');
  return /^\d{13}$/.test(brut) ? brut : null;
}

export function useRecherche(saisie: string, surCodeBarres: (ean: string) => void, delai: number = DELAI_RECHERCHE) {
  const [etat, setEtat] = useState<EtatRecherche>({ phase: 'repos' });
  const [essai, setEssai] = useState(0);
  const enVol = useRef<AbortController | null>(null);
  const surCodeBarresRef = useRef(surCodeBarres);
  surCodeBarresRef.current = surCodeBarres;

  const annuler = useCallback(() => {
    enVol.current?.abort();
    enVol.current = null;
  }, []);

  const lancer = useCallback(
    async (q: string) => {
      annuler();
      const controle = new AbortController();
      enVol.current = controle;
      setEtat({ phase: 'recherche' });
      const r = await appel<ResultatRecherche>(`/api/v1/recherche?q=${encodeURIComponent(q)}`, { signal: controle.signal });
      // Annulée entre-temps : une frappe plus récente a sa propre requête, celle-ci ne dit plus rien.
      if (controle.signal.aborted) return;
      enVol.current = null;
      if (r.ok) {
        const d = r.data ?? { q, produits: [], lignes: [] };
        setEtat(d.produits.length + d.lignes.length > 0 ? { phase: 'resultats', q, resultat: d } : { phase: 'vide', q });
      } else {
        setEtat({ phase: 'echec', q, message: r.statut === 429 ? 'Trop de recherches, patientez une minute.' : r.code === 'reseau' ? phraseErreur(r) : 'Recherche indisponible.' });
      }
    },
    [annuler],
  );

  useEffect(() => {
    const q = saisie.trim();
    const ean = estCodeBarres(q);
    if (ean) {
      annuler();
      setEtat({ phase: 'repos' });
      surCodeBarresRef.current(ean);
      return;
    }
    if (q.length < MIN_CARACTERES) {
      annuler();
      setEtat({ phase: 'repos' });
      return;
    }
    const minuteur = setTimeout(() => void lancer(q), delai);
    return () => clearTimeout(minuteur);
  }, [saisie, essai, delai, lancer, annuler]);

  // Au démontage : rien ne reste en vol.
  useEffect(() => annuler, [annuler]);

  const reessayer = useCallback(() => setEssai((n) => n + 1), []);
  return { etat, reessayer };
}
