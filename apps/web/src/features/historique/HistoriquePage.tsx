import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bandeau } from '../../components/Bandeau';
import { Bouton, BoutonLien } from '../../components/Bouton';
import { Carte } from '../../components/Carte';
import { BoutonRetour, Ecran, Marque } from '../../components/Ecran';
import { Emoji } from '../../components/Emoji';
import { Pastille } from '../../components/Pastille';
import { quand } from '../../lib/dates';
import { effacerHistorique, lireHistorique, retirerEntreeHistorique, type EntreeHistorique } from '../../lib/historique';

/**
 * /historique (lot 4) — les 20 derniers produits vérifiés sur CE téléphone, du plus récent au plus ancien ; une ligne se
 * retire d'un clic, « Tout effacer » se confirme EN PLACE. Rien n'est envoyé nulle part.
 */
export function HistoriquePage() {
  const [liste, setListe] = useState<EntreeHistorique[] | null>(null);
  const [confirmer, setConfirmer] = useState(false);

  useEffect(() => {
    setListe(lireHistorique());
  }, []);

  return (
    <Ecran
      barre={
        <>
          <BoutonRetour />
          <Marque centre />
          <span className="w-tap" aria-hidden="true" />
        </>
      }
      pied={
        <BoutonLien to="/scan" variante="accent" accent={1} bloc>
          Photographier un produit
        </BoutonLien>
      }
    >
      <h1 className="text-title font-bold">
        Historique
        <Emoji>🛒</Emoji>
      </h1>
      <p className="muet">Gardés sur ce téléphone seulement · les 20 derniers.</p>
      {liste === null ? (
        <p className="muet" role="status">
          Lecture…
        </p>
      ) : liste.length === 0 ? (
        <Carte>
          <p>Pas encore de produit : photographiez-en un.</p>
        </Carte>
      ) : (
        <>
          <Carte aria-labelledby="titre-liste">
            <h2 id="titre-liste" className="cache-visuel">
              Produits vérifiés
            </h2>
            <ul className="liste" role="list">
              {liste.map((e) => (
                <li key={e.ean} className="flex items-center gap-2">
                  <Link to={`/produit/${e.ean}`} className="flex min-h-tap min-w-0 flex-auto flex-wrap items-center gap-x-3 gap-y-[6px] text-text no-underline">
                    <div className="min-w-0 flex-auto">
                      <p className="font-semibold">{e.nom}</p>
                      <p className="muet">{[e.marque, quand(e.le)].filter(Boolean).join(' · ')}</p>
                    </div>
                    <Pastille ton={e.ton} className="max-w-full">
                      {e.pastille}
                    </Pastille>
                  </Link>
                  <button type="button" className="btn-icone flex-none" aria-label={`Retirer ${e.nom} de l’historique`} onClick={() => setListe(retirerEntreeHistorique(e.ean))}>
                    <span aria-hidden="true" className="text-19 font-bold leading-none">
                      ×
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Carte>
          {confirmer ? (
            <Bandeau ton="warn" role="alert">
              <p className="font-semibold">Effacer tout l’historique de ce téléphone ?</p>
              <p>Les {liste.length} produit{liste.length > 1 ? 's' : ''} disparaissent de cette liste ; les fiches, elles, restent.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Bouton
                  variante="primaire"
                  onClick={() => {
                    effacerHistorique();
                    setListe([]);
                    setConfirmer(false);
                  }}
                >
                  Oui, tout effacer
                </Bouton>
                <Bouton onClick={() => setConfirmer(false)}>Garder</Bouton>
              </div>
            </Bandeau>
          ) : (
            <Bouton bloc onClick={() => setConfirmer(true)}>
              Tout effacer
            </Bouton>
          )}
        </>
      )}
    </Ecran>
  );
}
