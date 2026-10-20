import { useEffect, useState } from 'react';
import type { CarteProduit } from '@moutar/shared-types';
import { Bouton } from '../../components/Bouton';
import { resumeDePartage } from './partage-regles';

type Etat = { phase: 'repos' } | { phase: 'copie' } | { phase: 'echec'; message: string };

/**
 * « Partager » (lot 4) : la feuille de partage du téléphone (`navigator.share`) quand elle existe — titre, résumé avec ses
 * sources, adresse de la fiche (un EAN, rien de personnel) ; sinon « Copier le résumé » dans le presse-papiers, avec une
 * confirmation EN PLACE. Jamais une nouvelle fenêtre.
 */
export function Partager({ carte }: { carte: CarteProduit }) {
  const [etat, setEtat] = useState<Etat>({ phase: 'repos' });
  const peutPartager = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (etat.phase !== 'copie') return;
    const t = setTimeout(() => setEtat({ phase: 'repos' }), 4000);
    return () => clearTimeout(t);
  }, [etat.phase]);

  const partager = async () => {
    const r = resumeDePartage(carte);
    const url = r.chemin ? `${window.location.origin}${r.chemin}` : undefined;
    if (peutPartager) {
      try {
        await navigator.share({ title: r.titre, text: r.texte, url });
        return;
      } catch (e) {
        // L'utilisateur a refermé la feuille : rien à dire. Une autre erreur : on tombe sur la copie.
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url ? `${r.texte}\n${url}` : r.texte);
      setEtat({ phase: 'copie' });
    } catch {
      setEtat({ phase: 'echec', message: 'Le presse-papiers n’est pas accessible : sélectionnez le texte de la carte pour le copier.' });
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-1">
      <Bouton bloc onClick={() => void partager()}>
        {peutPartager ? 'Partager' : 'Copier le résumé'}
      </Bouton>
      <p className="muet text-center" role="status" aria-live="polite">
        {etat.phase === 'copie' ? 'Résumé copié : collez-le où vous voulez.' : etat.phase === 'echec' ? etat.message : 'La synthèse et ses sources, sans rien de personnel.'}
      </p>
    </div>
  );
}
