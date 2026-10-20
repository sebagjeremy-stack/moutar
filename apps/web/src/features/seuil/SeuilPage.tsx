import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Niveau } from '@moutar/shared-types';
import { LIBELLES_NIVEAUX, NIVEAUX } from '@moutar/shared-types/regles/niveaux';
import { Bouton } from '../../components/Bouton';
import { Carte } from '../../components/Carte';
import { BoutonRetour, Ecran, Marque } from '../../components/Ecran';
import { ecrireSeuilLocal, lireSeuilLocal } from '../../lib/stockage-local';

const EXPLICATIONS: Record<Niveau, string> = {
  1: 'Seul un logo de certification reconnu sur l’emballage me suffit.',
  2: 'Un logo, ou une liste officielle (Consistoire de Paris, Rav Wolff) qui cite le produit.',
  3: 'Jusqu’aux contributions communautaires sourcées (Les Bons Plans Cachères).',
  4: 'Jusqu’à la composition seule — qui ne garantit rien : équipement, arômes, lait, vin ne s’y lisent pas.',
};

/** Mon seuil : quatre choix, gardé sur le téléphone. */
export function SeuilPage() {
  const navigate = useNavigate();
  const [seuil, setSeuil] = useState<Niveau>(() => lireSeuilLocal());

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
        <Bouton
          variante="primaire"
          bloc
          onClick={() => {
            ecrireSeuilLocal(seuil);
            navigate('/');
          }}
        >
          Garder ce seuil
        </Bouton>
      }
    >
      <h1 className="text-title font-bold">Mon seuil</h1>
      <p className="muet">Je m’arrête au niveau choisi : au-delà, une source ne fonde jamais un « permis ». Un « non cacher » se lit à tout niveau.</p>
      <Carte>
        <fieldset className="m-0 border-0 p-0">
          <legend className="cache-visuel">Niveau</legend>
          <ul className="liste" role="list">
            {NIVEAUX.map((n) => (
              <li key={n}>
                <label className="flex min-h-tap cursor-pointer items-start gap-3">
                  <input type="radio" name="seuil" value={n} checked={seuil === n} onChange={() => setSeuil(n)} className="mt-[5px] h-5 w-5 flex-none accent-primary" />
                  <span>
                    <span className="block font-semibold">
                      Niveau {n} · {LIBELLES_NIVEAUX[n]}
                    </span>
                    <span className="muet block">{EXPLICATIONS[n]}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      </Carte>
    </Ecran>
  );
}
