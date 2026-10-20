import type { LigneTrouvee, ProduitTrouve } from '@moutar/shared-types';
import { libelleMention } from '@moutar/shared-types/catalogues/rubriques-listes';
import { Bandeau } from '../../components/Bandeau';
import { Bouton } from '../../components/Bouton';
import { Carte } from '../../components/Carte';
import { Pastille } from '../../components/Pastille';
import { formaterEan, formaterJourCivil } from '../../lib/dates';
import { LIBELLE_CODE } from '../../lib/listes';
import type { EtatRecherche } from './useRecherche';

/** Une suggestion : un produit connu (→ sa fiche) ou une ligne d'une liste (→ un panneau en place). */
export type Option = { type: 'produit'; produit: ProduitTrouve & { ean: string } } | { type: 'ligne'; ligne: LigneTrouvee };

/** Les options dans l'ordre de la liste : d'abord les produits connus (avec un EAN), puis les lignes des listes. */
export function optionsDe(etat: EtatRecherche): Option[] {
  if (etat.phase !== 'resultats') return [];
  const produits = etat.resultat.produits.filter((p): p is ProduitTrouve & { ean: string } => typeof p.ean === 'string' && p.ean.length > 0).map((produit): Option => ({ type: 'produit', produit }));
  const lignes = etat.resultat.lignes.map((ligne): Option => ({ type: 'ligne', ligne }));
  return [...produits, ...lignes];
}

export const idOption = (i: number) => `suggestion-${i}`;

/** « rubrique · marque · libellé » d'une ligne de liste, sans doublon ni vide. */
export function libelleLigne(l: LigneTrouvee): string {
  return [l.rubrique, l.touteMarque ? 'toute marque' : l.marque, l.produitLibelle].filter(Boolean).join(' · ');
}

export function Suggestions({ etat, options, actif, surChoix, surSurvol, reessayer }: { etat: EtatRecherche; options: Option[]; actif: number; surChoix: (o: Option) => void; surSurvol: (i: number) => void; reessayer: () => void }) {
  if (etat.phase === 'repos') return null;
  if (etat.phase === 'recherche') {
    return (
      <p className="muet" role="status" aria-live="polite">
        Recherche…
      </p>
    );
  }
  if (etat.phase === 'echec') {
    return (
      <Bandeau ton="warn" role="alert" className="flex flex-wrap items-center gap-3">
        <Pastille ton="warn">Recherche indisponible</Pastille>
        <span className="min-w-0 flex-1">{etat.message}</span>
        <Bouton className="min-h-[40px]" onClick={reessayer}>
          Réessayer
        </Bouton>
      </Bandeau>
    );
  }
  if (etat.phase === 'vide' || options.length === 0) {
    return (
      <p className="muet" role="status" aria-live="polite">
        Aucun résultat pour « {etat.q} ». Photographiez le code-barres : la fiche se crée au besoin.
      </p>
    );
  }
  const nbProduits = options.filter((o) => o.type === 'produit').length;
  const nbLignes = options.length - nbProduits;
  const rendre = (o: Option, index: number) => {
    const choisi = index === actif;
    const classe = `flex min-h-tap w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-gutter py-2 text-left ${choisi ? 'bg-primary-soft' : ''}`;
    const commun = { role: 'option' as const, id: idOption(index), 'aria-selected': choisi, onMouseEnter: () => surSurvol(index), onClick: () => surChoix(o) };
    if (o.type === 'produit') {
      return (
        <li key={`p-${o.produit.id}`} {...commun} className={classe}>
          <span className="min-w-0 flex-auto">
            <span className="block font-semibold">{o.produit.nom}</span>
            <span className="muet block">{[o.produit.marque, `EAN ${formaterEan(o.produit.ean)}`].filter(Boolean).join(' · ')}</span>
          </span>
        </li>
      );
    }
    const l = o.ligne;
    return (
      <li key={`l-${l.id}`} {...commun} className={classe}>
        <span className="min-w-0 flex-auto">
          <span className="block font-semibold">{libelleLigne(l)}</span>
          <span className="muet block">{l.source}</span>
        </span>
        {l.perimee ? <Pastille ton="warn">Liste périmée</Pastille> : null}
      </li>
    );
  };
  // Les intitulés de groupe sont des `presentation` (hors des options) ; l'index d'une option suit l'ordre des options.
  return (
    <div className="carte !px-0 !py-1">
      <p className="cache-visuel" role="status" aria-live="polite">
        {nbProduits} produit{nbProduits > 1 ? 's' : ''} connu{nbProduits > 1 ? 's' : ''}, {nbLignes} ligne{nbLignes > 1 ? 's' : ''} de liste. Flèches pour parcourir, Entrée pour ouvrir.
      </p>
      <ul id="suggestions" role="listbox" aria-label="Suggestions" className="m-0 list-none p-0">
        {nbProduits > 0 ? (
          <li role="presentation" className="muet px-gutter pb-1 pt-2 font-semibold">
            Produits connus
          </li>
        ) : null}
        {options.slice(0, nbProduits).map((o, i) => rendre(o, i))}
        {nbLignes > 0 ? (
          <li role="presentation" className="muet border-t border-border px-gutter pb-1 pt-2 font-semibold">
            Dans les listes officielles
          </li>
        ) : null}
        {options.slice(nbProduits).map((o, i) => rendre(o, nbProduits + i))}
      </ul>
    </div>
  );
}

/**
 * Le panneau d'une ligne de liste, EN PLACE (pas de nouvelle page) : ce que la liste dit, sa source et ses dates, et
 * le rappel qu'un produit précis se vérifie par son code-barres. Rien n'est gardé.
 */
export function PanneauLigne({ ligne: l, surFermeture }: { ligne: LigneTrouvee; surFermeture: () => void }) {
  const mention = libelleMention(l.mention);
  const validite = l.valableJusquAu ? `${l.perimee ? 'expirée le' : 'valable jusqu’au'} ${formaterJourCivil(l.valableJusquAu)}` : 'sans date de fin annoncée';
  return (
    <Carte className={l.perimee ? 'synthese-warn' : 'synthese-ok'} aria-labelledby="titre-panneau-ligne" role="region">
      <div className="mb-2 flex flex-wrap items-center gap-x-[10px] gap-y-2">
        <h2 id="titre-panneau-ligne" className="flex-auto text-18 font-bold">
          Dans la liste {LIBELLE_CODE[l.code]}
        </h2>
        {/* Ce qui est su : la liste est valide ou périmée — pas un verdict sur un produit (il se vérifie par son code-barres). */}
        <Pastille ton={l.perimee ? 'warn' : 'ok'}>{l.perimee ? 'Liste périmée' : 'Liste valide'}</Pastille>
      </div>
      <p>
        Cette ligne de « {l.source} » dit : rubrique « {l.rubrique} »{l.touteMarque ? ', toute marque autorisée' : l.marque ? `, marque « ${l.marque} »` : ''}
        {l.produitLibelle ? `, produit « ${l.produitLibelle} »` : ''}
        {mention ? ` — mention : ${mention}` : ''}.
      </p>
      <p className="muet mt-1">
        {l.publieLe ? `Publiée le ${formaterJourCivil(l.publieLe)} · ` : ''}
        {validite}.
      </p>
      {l.perimee ? <Bandeau ton="warn" className="mt-2">Cette liste est périmée : attendre l’édition suivante.</Bandeau> : null}
      <p className="mt-2">Pour vérifier un produit précis, photographiez son code-barres.</p>
      <Bouton className="mt-3" bloc onClick={surFermeture}>
        Fermer
      </Bouton>
    </Carte>
  );
}
