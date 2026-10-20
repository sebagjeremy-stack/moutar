import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Niveau } from '@moutar/shared-types';
import { LIBELLES_NIVEAUX, NIVEAUX } from '@moutar/shared-types/regles/niveaux';
import { Bouton } from '../../components/Bouton';
import { BoutonRetour, Ecran, Marque } from '../../components/Ecran';
import { Emoji } from '../../components/Emoji';
import { PastilleNumero } from '../../components/PastilleNumero';
import { ecrireSeuilLocal, lireSeuilLocal } from '../../lib/stockage-local';

const EXPLICATIONS: Record<Niveau, string> = {
  1: 'Seul un logo de certification reconnu sur l’emballage me suffit.',
  2: 'Un logo, ou une liste officielle (Consistoire de Paris, Rav Wolff) qui cite le produit.',
  3: 'Jusqu’aux contributions communautaires sourcées (Les Bons Plans Cachères).',
  4: 'Jusqu’à la composition seule — qui ne garantit rien : équipement, arômes, lait, vin ne s’y lisent pas.',
};

/** Les classes en toutes lettres : Tailwind ne conserve que les noms qu'il lit dans les sources. */
const CLASSE_CHOIX: Record<Niveau, string> = { 1: 'choix-seuil-1', 2: 'choix-seuil-2', 3: 'choix-seuil-3', 4: 'choix-seuil-4' };

/** Mon seuil : quatre grandes cartes (un accent chacune, décoratif), celle choisie entourée de lavande et le mot « Choisi » écrit ; gardé sur le téléphone. */
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
      <h1 className="text-title font-bold">
        Mon seuil
        <Emoji>🎯</Emoji>
      </h1>
      <p>Je m’arrête au niveau choisi : au-delà, une source ne fonde jamais un « permis ». Un « non cacher » se lit à tout niveau.</p>
      <fieldset className="m-0 border-0 p-0">
        <legend className="cache-visuel">Niveau</legend>
        <ul className="flex flex-col gap-3" role="list">
          {NIVEAUX.map((n) => {
            const choisi = seuil === n;
            return (
              <li key={n}>
                <label className={`choix-seuil ${CLASSE_CHOIX[n]} ${choisi ? 'choix-seuil-choisi' : ''}`}>
                  <input type="radio" name="seuil" value={n} checked={choisi} onChange={() => setSeuil(n)} className="cache-visuel" />
                  <PastilleNumero niveau={n} className="mt-[2px]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="font-display text-17 font-bold">{LIBELLES_NIVEAUX[n]}</span>
                      {choisi ? <span className="text-small font-bold text-primary-strong">Choisi</span> : null}
                    </span>
                    <span className="block">{EXPLICATIONS[n]}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
    </Ecran>
  );
}
