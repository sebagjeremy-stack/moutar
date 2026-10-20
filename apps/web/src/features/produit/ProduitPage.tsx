import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CarteProduit, LigneCarte, Produit, SousLigneListe, Ton } from '@moutar/shared-types';
import { libelleNiveau } from '@moutar/shared-types/regles/niveaux';
import { Bandeau } from '../../components/Bandeau';
import { Bouton, BoutonLien } from '../../components/Bouton';
import { Carte } from '../../components/Carte';
import { Champ, ZoneTexte } from '../../components/Champ';
import { BoutonRetour, Ecran, Marque } from '../../components/Ecran';
import { IconeChevron, IconeImage } from '../../components/Icones';
import { Emoji } from '../../components/Emoji';
import { Pastille } from '../../components/Pastille';
import { PastilleNumero } from '../../components/PastilleNumero';
import { appel, envoyer, lire } from '../../lib/api';
import { phraseErreur } from '../../lib/erreurs';
import { formaterEan, formaterJour } from '../../lib/dates';
import { noterDansHistorique } from '../../lib/historique';
import { lireSeuilLocal } from '../../lib/stockage-local';
import { IngredientsEnGras } from './IngredientsEnGras';
import { Partager } from './Partager';
import { datesSousLigne, pastilleSousLigne, precisionSousLigne, SANS_LISTE } from './sous-lignes-regles';

/** La bordure de la synthèse, en toutes lettres pour Tailwind ; aucune pour « neutre ». */
const CLASSE_SYNTHESE: Record<Ton, string> = { ok: 'synthese-ok', warn: 'synthese-warn', danger: 'synthese-danger', neutre: '' };

type Etat = { phase: 'chargement' } | { phase: 'carte'; carte: CarteProduit } | { phase: 'inconnu' } | { phase: 'echec'; message: string };

/** /produit/:ean — la carte produit de la maquette ; produit inconnu → création manuelle ; échec → « non lu » + Réessayer. */
export function ProduitPage() {
  const { ean = '' } = useParams();
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' });

  const charger = useCallback(async () => {
    setEtat({ phase: 'chargement' });
    const r = await lire<CarteProduit>(`/api/v1/produits/${encodeURIComponent(ean)}/carte?seuil=${lireSeuilLocal()}`);
    if (r.ok) {
      setEtat({ phase: 'carte', carte: r.data });
      noterDansHistorique({ ean, nom: r.data.produit.nom, marque: r.data.produit.marque, pastille: r.data.synthese.pastille, ton: r.data.synthese.ton, le: new Date().toISOString() });
      return;
    }
    if (r.code === 'produit_inconnu') setEtat({ phase: 'inconnu' });
    else setEtat({ phase: 'echec', message: r.message });
  }, [ean]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const barre = (
    <>
      <BoutonRetour />
      <Marque centre />
      <span className="w-tap" aria-hidden="true" />
    </>
  );

  if (etat.phase === 'chargement') {
    return (
      <Ecran barre={barre}>
        <p className="muet" role="status">
          Lecture de la fiche…
        </p>
      </Ecran>
    );
  }
  if (etat.phase === 'echec') {
    return (
      <Ecran barre={barre} pied={<BoutonLien to="/" variante="primaire" className="flex-1">Nouveau produit</BoutonLien>}>
        <h1 className="text-19 font-semibold">EAN {formaterEan(ean)}</h1>
        <Carte className="synthese-warn">
          <div className="mb-2 flex flex-wrap items-center gap-x-[10px] gap-y-2">
            <h2 className="flex-1 text-18 font-bold">Fiche non lue</h2>
            <Pastille ton="warn">Non lu</Pastille>
          </div>
          <p>{etat.message}</p>
          <div className="mt-3 flex flex-col gap-2">
            <Bouton variante="primaire" bloc onClick={() => void charger()}>
              Réessayer
            </Bouton>
            <button type="button" className="lien" onClick={() => setEtat({ phase: 'inconnu' })}>
              Créer le produit à la main
            </button>
          </div>
        </Carte>
      </Ecran>
    );
  }
  if (etat.phase === 'inconnu') return <ProduitInconnu ean={ean} barre={barre} surCree={() => void charger()} />;
  return <CarteProduitVue carte={etat.carte} barre={barre} surRelire={() => void charger()} />;
}

function CarteProduitVue({ carte, barre, surRelire }: { carte: CarteProduit; barre: React.ReactNode; surRelire: () => void }) {
  const { produit: p, synthese, lignes } = carte;
  const ingredients = p.ingredientsTexte;
  const codes = carte.analyse?.additifs.map((a) => a.code) ?? [];
  return (
    <Ecran
      barre={barre}
      pied={
        <>
          <Bouton className="flex-1 whitespace-nowrap px-[10px]" aria-disabled="true" title="Le signalement arrive au lot 5" onClick={(e) => e.preventDefault()}>
            Signaler une erreur
          </Bouton>
          <BoutonLien to="/" variante="primaire" className="flex-1 whitespace-nowrap px-[10px]">
            Nouveau produit
          </BoutonLien>
        </>
      }
    >
      <section className="flex items-start gap-[14px]" aria-labelledby="nom-produit">
        {/* Vignette teintée lagon (décoration) */}
        <div className="flex h-[76px] w-[76px] flex-none items-center justify-center overflow-hidden rounded-[20px] border border-border bg-accent-3-soft text-accent-3-hover" aria-hidden="true">
          {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-cover" /> : <IconeImage className="h-7 w-7" />}
        </div>
        <div>
          <h1 id="nom-produit" className="mb-[2px] text-19 font-bold">
            {p.nom}
          </h1>
          {p.marque ? <p className="font-semibold">{p.marque}</p> : null}
          {p.ean ? <p className="muet mt-[2px]">EAN {formaterEan(p.ean)}</p> : null}
          <p className="muet mt-[2px]">
            {p.source === 'off' ? 'Fiche Open Food Facts' : p.source === 'manuel' ? 'Fiche créée à la main' : 'Fiche lue sur l’étiquette'} · lue le {formaterJour(p.luLe)}
          </p>
        </div>
      </section>

      <Carte className={CLASSE_SYNTHESE[synthese.ton]} aria-labelledby="titre-synthese">
        <div className="mb-2 flex flex-wrap items-center gap-x-[10px] gap-y-2">
          <h2 id="titre-synthese" className="flex-auto text-18 font-bold">
            Selon votre seuil : {libelleNiveau(carte.seuil)}
          </h2>
          <Pastille ton={synthese.ton}>{synthese.pastille}</Pastille>
        </div>
        <p>{synthese.phrase}</p>
        {synthese.proposerScanIngredients ? (
          <>
            <BoutonLien to={`/produit/${p.ean ?? ''}/ingredients`} variante="primaire" bloc className="mt-3">
              Scanner les ingrédients
            </BoutonLien>
            <p className="muet mt-2">Ingrédients déjà connus par Open Food Facts : l’analyse se fait sans photo. Sinon, photographiez l’étiquette : le texte lu se relit avant d’être analysé.</p>
          </>
        ) : null}
        <Partager carte={carte} />
      </Carte>

      <Carte aria-labelledby="titre-niveaux">
        <h2 id="titre-niveaux" className="text-18 font-bold">
          Les quatre niveaux
          <Emoji>🧭</Emoji>
        </h2>
        <p className="muet mb-1">Une ligne par source, avec sa date et sa validité.</p>
        <ol className="liste" role="list">
          {lignes.map((l) => (
            <LigneNiveau key={l.niveau} ligne={l} ean={p.ean} tagsIgnores={l.niveau === 4 ? (carte.analyse?.tagsIgnores ?? 0) : 0} surRelire={surRelire} />
          ))}
        </ol>
      </Carte>

      <details className="carte">
        <summary>
          <h2 className="text-18 font-bold">
            Ingrédients
            <Emoji>🧾</Emoji>
          </h2>
          <IconeChevron className="chevron h-6 w-6 flex-none text-muted" />
        </summary>
        {ingredients ? (
          <p className="mt-[10px] leading-[1.55]">
            <IngredientsEnGras texte={ingredients} codes={codes} />
          </p>
        ) : (
          <p className="muet mt-[10px]">Les ingrédients ne sont pas connus pour cette fiche.</p>
        )}
        <p className="muet mt-[10px]">{p.source === 'off' ? 'Données Open Food Facts · ODbL' : 'Saisie manuelle · Open Food Facts (ODbL) pour les fiches lues'}</p>
      </details>
    </Ecran>
  );
}

/** Ce que le niveau proposera plus tard : un texte muet, sans apparence de lien (rien à cliquer avant le lot). */
const A_VENIR: Record<number, string> = {
  3: 'Proposer une contribution · bientôt (lot 5)',
};

function LigneNiveau({ ligne, ean, tagsIgnores, surRelire }: { ligne: LigneCarte; ean: string | null; tagsIgnores: number; surRelire: () => void }) {
  const aVenir = A_VENIR[ligne.niveau];
  // Niveau 2 (lot 2) : une sous-ligne PAR liste officielle, chacune avec sa pastille, sa date et sa validité — la pastille
  // et le détail du niveau ne se répètent pas (une information n'est écrite qu'une fois par vue).
  const sousLignes = ligne.niveau === 2 ? ligne.sousLignes : undefined;
  return (
    <li className="py-3">
      <div className="flex items-start gap-[10px]">
        {/* Le numéro coloré est décoratif (« Niveau N » est écrit aux lecteurs d'écran) ; le statut est dans la pastille sémantique. */}
        <PastilleNumero niveau={ligne.niveau} className="-mt-[2px]" />
        <div className="flex min-h-7 min-w-0 flex-1 flex-wrap items-center gap-x-[10px] gap-y-[6px]">
          <span className="flex-auto font-display text-17 font-bold">{libelleNiveau(ligne.niveau).split(' · ')[1]}</span>
          {sousLignes ? null : (
            <Pastille ton={ligne.ton} className="max-w-full">
              {ligne.pastille}
            </Pastille>
          )}
        </div>
      </div>
      {sousLignes ? <SousLignes sousLignes={sousLignes} /> : <p className="ml-[42px] mt-[6px]">{ligne.detail}</p>}
      {ligne.avertissement ? (
        <Bandeau ton="warn" className="ml-[42px] mt-2">
          {ligne.avertissement}
        </Bandeau>
      ) : null}
      {ligne.niveau === 1 && ean ? <ActionsNiveau1 ligne={ligne} ean={ean} surRelire={surRelire} /> : null}
      {ligne.niveau === 4 && ligne.composition === null && ean ? (
        <Link to={`/produit/${ean}/ingredients`} className="lien ml-[42px]">
          Saisir les ingrédients
        </Link>
      ) : null}
      {tagsIgnores > 0 ? (
        <p className="muet ml-[42px] mt-[6px]">
          {tagsIgnores} additif{tagsIgnores > 1 ? 's' : ''} non lu{tagsIgnores > 1 ? 's' : ''} (tags Open Food Facts que le code ne sait pas lire).
        </p>
      ) : null}
      {aVenir ? <p className="muet ml-[42px] mt-[6px]">{aVenir}</p> : null}
    </li>
  );
}

/**
 * Niveau 1 (lot 3) : une certification existe dès que la ligne a une source (validée, ou validée puis organisme désactivé) ;
 * elle se retire d'un clic confirmé EN PLACE (`DELETE`), et la carte se relit. Sinon, la photo du logo.
 */
function ActionsNiveau1({ ligne, ean, surRelire }: { ligne: LigneCarte; ean: string; surRelire: () => void }) {
  const [confirmer, setConfirmer] = useState(false);
  const [retrait, setRetrait] = useState<{ envoi: boolean; erreur: string | null }>({ envoi: false, erreur: null });
  const certifiee = ligne.source !== null;

  const retirer = async () => {
    setRetrait({ envoi: true, erreur: null });
    const r = await appel<{ ok: true }>(`/api/v1/produits/${encodeURIComponent(ean)}/certification`, { method: 'DELETE' });
    if (!r.ok && r.code !== 'certification_absente') {
      setRetrait({ envoi: false, erreur: phraseErreur(r) });
      return;
    }
    surRelire();
  };

  if (!certifiee) {
    return (
      <Link to={`/scan?pour=logo&ean=${encodeURIComponent(ean)}`} className="lien ml-[42px]">
        Photographier le logo
      </Link>
    );
  }
  if (confirmer) {
    return (
      <Bandeau ton="warn" role="alert" className="ml-[42px] mt-2">
        <p className="font-semibold">Retirer cette certification ?</p>
        <p>La ligne redevient « Aucun logo lu » ; vous pourrez reprendre une photo.</p>
        {retrait.erreur ? <p className="mt-1">{retrait.erreur}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <Bouton variante="primaire" disabled={retrait.envoi} onClick={() => void retirer()}>
            {retrait.envoi ? 'Retrait…' : 'Oui, retirer'}
          </Bouton>
          <Bouton disabled={retrait.envoi} onClick={() => setConfirmer(false)}>
            Garder
          </Bouton>
        </div>
      </Bandeau>
    );
  }
  return (
    <div className="ml-[42px] flex flex-wrap gap-x-4">
      <button type="button" className="lien" onClick={() => setConfirmer(true)}>
        Retirer
      </button>
      {ligne.statut !== 'cite' ? (
        <Link to={`/scan?pour=logo&ean=${encodeURIComponent(ean)}`} className="lien">
          Photographier le logo
        </Link>
      ) : null}
    </div>
  );
}

/** Les sources du niveau 2 : une par liste active (source, dates, pastille avec son mot, précision) ; aucune → une ligne ambre. */
function SousLignes({ sousLignes }: { sousLignes: SousLigneListe[] }) {
  if (sousLignes.length === 0) {
    return (
      <ul className="liste ml-[42px] mt-[6px]" role="list" aria-label="Sources du niveau 2">
        <li className="py-2">
          <div className="flex flex-wrap items-center gap-x-[10px] gap-y-[6px]">
            <p className="min-w-0 flex-auto">Aucune liste officielle n’est importée pour l’instant.</p>
            <Pastille ton={SANS_LISTE.ton} className="max-w-full">
              {SANS_LISTE.mot}
            </Pastille>
          </div>
        </li>
      </ul>
    );
  }
  return (
    <ul className="liste ml-[42px] mt-[6px]" role="list" aria-label="Sources du niveau 2">
      {sousLignes.map((s) => {
        const pastille = pastilleSousLigne(s);
        const precision = precisionSousLigne(s);
        return (
          <li key={s.listeId} className="py-2">
            <div className="flex flex-wrap items-center gap-x-[10px] gap-y-[6px]">
              <p className="min-w-0 flex-auto">
                <span className="font-semibold">{s.source}</span>
                <span className="muet block">{datesSousLigne(s)}</span>
              </p>
              <Pastille ton={pastille.ton} className="max-w-full">
                {pastille.mot}
              </Pastille>
            </div>
            {precision ? <p className="mt-1">{precision}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Produit inconnu d'Open Food Facts : création manuelle (nom, marque, ingrédients) ; l'EAN est gardé pour la prochaine fois. */
function ProduitInconnu({ ean, barre, surCree }: { ean: string; barre: React.ReactNode; surCree: () => void }) {
  const [nom, setNom] = useState('');
  const [marque, setMarque] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const creer = async (e: FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) {
      setErreur('Le nom du produit est obligatoire.');
      return;
    }
    setEnvoi(true);
    const r = await envoyer<Produit>('/api/v1/produits', { ean, nom, marque, ingredientsTexte: ingredients });
    setEnvoi(false);
    // Un EAN déjà connu (409 `produit_existant`) se relit comme une création : la fiche existe, on la charge.
    if (!r.ok && r.code !== 'produit_existant') {
      setErreur(r.message);
      return;
    }
    // Un seul chargement : l'adresse ne change pas, le parent relit la carte.
    surCree();
  };

  return (
    <Ecran barre={barre}>
      <h1 className="text-title font-bold">
        Produit inconnu
        <Emoji>🔍</Emoji>
      </h1>
      <p className="muet">EAN {formaterEan(ean)}</p>
      <Bandeau ton="warn">Open Food Facts ne connaît pas encore ce code-barres. Créez la fiche à la main : l’EAN sera gardé pour la prochaine fois.</Bandeau>
      <form className="flex flex-col gap-3" onSubmit={creer}>
        <Champ id="nom" etiquette="Nom du produit" value={nom} onChange={(e) => setNom(e.target.value)} required maxLength={200} autoFocus />
        <Champ id="marque" etiquette="Marque (facultatif)" value={marque} onChange={(e) => setMarque(e.target.value)} maxLength={200} />
        <ZoneTexte id="ingredients" etiquette="Ingrédients (facultatif)" aide="Recopiez la liste de l’étiquette, telle quelle. L’analyse des additifs se fait sur ce texte." value={ingredients} onChange={(e) => setIngredients(e.target.value)} maxLength={5000} />
        {erreur ? (
          <Bandeau ton="warn" role="alert">
            {erreur}
          </Bandeau>
        ) : null}
        <Bouton type="submit" variante="accent" accent={1} bloc disabled={envoi}>
          {envoi ? 'Création…' : 'Créer la fiche'}
        </Bouton>
      </form>
    </Ecran>
  );
}
