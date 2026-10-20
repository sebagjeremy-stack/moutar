import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { LigneTrouvee } from '@moutar/shared-types';
import { LIBELLES_NIVEAUX } from '@moutar/shared-types/regles/niveaux';
import { Bandeau } from '../../components/Bandeau';
import { Bouton, BoutonLien } from '../../components/Bouton';
import { Carte, EnteteCarte } from '../../components/Carte';
import { Ecran, Marque } from '../../components/Ecran';
import { IconeAppareil, IconeCrayon, IconeHistorique, IconeInfo, IconeMicro } from '../../components/Icones';
import { Pastille } from '../../components/Pastille';
import { quand } from '../../lib/dates';
import { lireHistorique, lireSeuilLocal, type EntreeHistorique } from '../../lib/stockage-local';
import { idOption, optionsDe, PanneauLigne, Suggestions, type Option } from './Suggestions';
import { useRecherche } from './useRecherche';

/** L'accueil de la maquette : Dicter (lot 4), Écrire (nom, marque ou code-barres : lot 2), Mon seuil, Derniers produits, le principe, le pied « Photographier ». */
export function AccueilPage() {
  const navigate = useNavigate();
  const [ouvert, setOuvert] = useState(true);
  const [saisie, setSaisie] = useState('');
  const [actif, setActif] = useState(-1);
  const [ferme, setFerme] = useState(false);
  const [panneau, setPanneau] = useState<LigneTrouvee | null>(null);
  const [historique, setHistorique] = useState<EntreeHistorique[]>([]);
  const [seuil, setSeuil] = useState(2 as ReturnType<typeof lireSeuilLocal>);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHistorique(lireHistorique());
    setSeuil(lireSeuilLocal());
  }, []);

  // 13 chiffres tapés → la fiche, sans appel ; sinon les suggestions dès 3 caractères (anti-rebond, annulation : `useRecherche`).
  const surCodeBarres = useCallback((ean: string) => navigate(`/produit/${ean}`), [navigate]);
  const { etat, reessayer } = useRecherche(saisie, surCodeBarres);
  const options = ferme ? [] : optionsDe(etat);
  const listeOuverte = options.length > 0;

  const choisir = (o: Option) => {
    if (o.type === 'produit') {
      navigate(`/produit/${o.produit.ean}`);
      return;
    }
    setPanneau(o.ligne);
    setFerme(true);
    setActif(-1);
  };

  const chercher = (e: FormEvent) => {
    e.preventDefault();
    if (listeOuverte && actif >= 0 && options[actif]) {
      choisir(options[actif]);
      return;
    }
    // Entrée sur un code-barres plus court que 13 chiffres (EAN-8, 12, 14) : la fiche quand même.
    const ean = saisie.replace(/\s/g, '');
    if (/^\d{8,14}$/.test(ean)) navigate(`/produit/${ean}`);
  };

  const clavier = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (listeOuverte) {
        e.preventDefault();
        setFerme(true);
        setActif(-1);
      }
      return;
    }
    if (!listeOuverte) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActif((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActif((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === 'Home' && listeOuverte) {
      e.preventDefault();
      setActif(0);
    } else if (e.key === 'End' && listeOuverte) {
      e.preventDefault();
      setActif(options.length - 1);
    }
  };

  return (
    <Ecran
      barre={
        <>
          <Marque />
          <Link to="/" className="btn-icone" aria-label="Historique des produits vérifiés" aria-disabled="true" title="Écran complet au lot 4">
            <IconeHistorique className="h-6 w-6" />
          </Link>
        </>
      }
      pied={
        <div className="flex w-full flex-col gap-2">
          <p className="muet px-2 text-center">Code-barres, logo de certification ou liste d’ingrédients : une seule photo suffit.</p>
          {/* Corail : l'action chaleureuse de la maquette (accent décoratif, jamais un sens). */}
          <BoutonLien to="/scan" variante="accent" accent={1} grand bloc>
            <IconeAppareil className="h-7 w-7" />
            Photographier le produit
          </BoutonLien>
        </div>
      }
    >
      <h1 className="cache-visuel">Vérifier un produit</h1>

      <div className="grid grid-cols-2 gap-[10px] pt-1">
        {/* Les deux voies secondaires : icône teintée d'un accent (décoration : le mot est à côté). */}
        <Bouton className="min-h-[56px]" aria-disabled="true" title="La dictée arrive au lot 4" onClick={(e) => e.preventDefault()}>
          <IconeMicro className="h-[22px] w-[22px] text-accent-3-hover" />
          Dicter
        </Bouton>
        <Bouton
          className={`min-h-[56px] ${ouvert ? 'border-primary bg-primary-soft text-primary-strong' : ''}`}
          aria-expanded={ouvert}
          aria-controls="recherche"
          onClick={() => {
            setOuvert(!ouvert);
            if (!ouvert) setTimeout(() => champ.current?.focus(), 0);
          }}
        >
          <IconeCrayon className={`h-[22px] w-[22px] ${ouvert ? 'text-primary-strong' : 'text-accent-2-hover'}`} />
          Écrire
        </Bouton>
      </div>

      <form id="recherche" role="search" hidden={!ouvert} className="flex flex-col gap-[6px]" onSubmit={chercher}>
        <label className="cache-visuel" htmlFor="champ-produit">
          Nom du produit, marque ou code-barres
        </label>
        <input
          ref={champ}
          id="champ-produit"
          className="champ"
          type="search"
          placeholder="Nom du produit, marque ou code-barres…"
          autoComplete="off"
          aria-describedby="aide-produit"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={listeOuverte}
          aria-controls="suggestions"
          aria-activedescendant={listeOuverte && actif >= 0 ? idOption(actif) : undefined}
          value={saisie}
          onChange={(e) => {
            setSaisie(e.target.value);
            setFerme(false);
            setActif(-1);
            setPanneau(null);
          }}
          onKeyDown={clavier}
        />
        <p className="muet" id="aide-produit">
          Suggestions dès 3 caractères ; un code-barres de 13 chiffres ouvre la fiche.
        </p>
        {ferme ? null : <Suggestions etat={etat} options={options} actif={actif} surChoix={choisir} surSurvol={setActif} reessayer={reessayer} />}
      </form>

      {panneau ? <PanneauLigne ligne={panneau} surFermeture={() => { setPanneau(null); champ.current?.focus(); }} /> : null}

      <Carte aria-labelledby="titre-seuil">
        <EnteteCarte
          id="titre-seuil"
          titre="Mon seuil"
          emoji="🎯"
          action={
            <Link to="/seuil" className="lien no-underline hover:underline" aria-label="Modifier mon seuil">
              Modifier
            </Link>
          }
        />
        <p className="font-semibold">
          Je m’arrête au niveau {seuil} · {LIBELLES_NIVEAUX[seuil]}
        </p>
        <p className="muet mt-1">Niveaux : 1 Certifié · 2 Liste officielle · 3 Communautaire · 4 Sur composition.</p>
      </Carte>

      <Carte aria-labelledby="titre-derniers">
        <EnteteCarte id="titre-derniers" titre="Derniers produits" emoji="🛒" />
        <p className="muet mb-1">Gardés sur ce téléphone seulement.</p>
        {historique.length === 0 ? (
          <p className="muet">Rien pour l’instant : votre premier produit vérifié s’affichera ici.</p>
        ) : (
          <ul className="liste" role="list">
            {historique.map((e) => (
              <li key={e.ean}>
                <Link to={`/produit/${e.ean}`} className="flex min-h-tap flex-wrap items-center gap-x-3 gap-y-[6px] text-text no-underline">
                  <div className="min-w-0 flex-auto">
                    <p className="font-semibold">{e.nom}</p>
                    <p className="muet">{[e.marque, quand(e.le)].filter(Boolean).join(' · ')}</p>
                  </div>
                  <Pastille ton={e.ton} className="max-w-full">
                    {e.pastille}
                  </Pastille>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Carte>

      <Bandeau ton="info" className="mt-1 flex items-start gap-[10px]">
        <IconeInfo className="mt-[1px] h-5 w-5 flex-none" />
        <span>Cette application ne décide pas, elle cite : chaque réponse porte sa source et sa date.</span>
      </Bandeau>

      <p className="muet text-center">Open Food Facts · ODbL</p>
    </Ecran>
  );
}
