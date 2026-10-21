import { useState } from 'react';

/** Les petits outils partagés des onglets de la console (lot 5). */

export type Refus = (statut: number) => void;

/** Un filtre à choix unique (états d'une liste) : des boutons, l'actuel marqué `aria-pressed` ; l'état vit dans l'adresse. */
export function Filtre<T extends string>({ legende, choix, valeur, surChoix }: { legende: string; choix: ReadonlyArray<[T, string]>; valeur: T; surChoix: (v: T) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={legende}>
      {choix.map(([v, libelle]) => (
        <button key={v} type="button" className={`btn min-h-[40px] ${valeur === v ? 'border-primary bg-primary-soft text-primary-strong' : ''}`} aria-pressed={valeur === v} onClick={() => surChoix(v)}>
          {libelle}
        </button>
      ))}
    </div>
  );
}

/**
 * Une adresse affichée en TEXTE, copiable — jamais un lien cliquable : la console n'ouvre aucune nouvelle fenêtre et ne suit
 * pas un lien déposé par le public. « Copier » passe par le presse-papiers s'il existe ; sinon le texte reste sélectionnable.
 */
export function TexteCopiable({ etiquette, texte }: { etiquette: string; texte: string }) {
  const [copie, setCopie] = useState<'non' | 'oui' | 'impossible'>('non');
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie('oui');
    } catch {
      setCopie('impossible');
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="muet">{etiquette} :</span>
      <code className="min-w-0 select-all break-all rounded-sm bg-surface-2 px-2 py-1 text-small">{texte}</code>
      <button type="button" className="lien min-h-[40px]" onClick={() => void copier()}>
        Copier
      </button>
      <span className="muet" role="status">
        {copie === 'oui' ? 'Copié.' : copie === 'impossible' ? 'Sélectionnez le texte pour le copier.' : ''}
      </span>
    </div>
  );
}
