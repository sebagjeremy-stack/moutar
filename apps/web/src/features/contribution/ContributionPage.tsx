import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ContributionProposee, Produit, SourceContribution, StatutContribution } from '@moutar/shared-types';
import { SOURCES_CONTRIBUTION } from '@moutar/shared-types/catalogues/contributions';
import { Bandeau } from '../../components/Bandeau';
import { Bouton, BoutonLien } from '../../components/Bouton';
import { Carte } from '../../components/Carte';
import { Champ, ZoneTexte } from '../../components/Champ';
import { BoutonRetour, Ecran, Marque } from '../../components/Ecran';
import { Emoji } from '../../components/Emoji';
import { envoyer, lire } from '../../lib/api';
import { formaterEan, formaterJourCivil, jourLocal } from '../../lib/dates';
import { phraseErreur } from '../../lib/erreurs';
import { AUTEUR_NOM_MAX, corpsProposition, erreursProposition, HOTES_PREUVE, SOURCE_TEXTE_MAX, type ErreursProposition } from './contribution-regles';

/*
 * /produit/:ean/contribution — « Proposer une contribution » (lot 5) : une question par écran, mobile, pouce droit.
 * (1) ce que dit la source, (2) la source, (3) le texte, la date, le lien, le pseudonyme, (4) le récapitulatif → envoi.
 * Rien n'est gardé sur le téléphone (ni brouillon, ni pseudonyme) ; aucune photo ; un lien de preuve au plus.
 * Page LÉGÈRE : aucun éditeur, aucun lecteur ; le produit n'est lu que pour écrire son nom (l'EAN suffit sinon).
 */

type Etape = 1 | 2 | 3 | 4;
type Envoi = { phase: 'saisie'; erreur: string | null } | { phase: 'envoi' } | { phase: 'envoye' };

const STATUTS: Array<{ valeur: StatutContribution; titre: string; aide: string; accent: 1 | 2 | 3 }> = [
  { valeur: 'cite', titre: 'Le produit est cité comme cacher', aide: 'La source le dit permis (une liste, un message validé par le groupe).', accent: 3 },
  { valeur: 'douteux', titre: 'Le produit est signalé douteux', aide: 'La source invite à vérifier avant d’acheter. Jamais un « non cacher » : Moutar cite, il ne décide pas.', accent: 2 },
  { valeur: 'non_cite', titre: 'Le produit n’est pas cité', aide: 'La source ne le mentionne pas. Ce n’est pas un « non ».', accent: 1 },
];

const SOURCES: Array<{ valeur: SourceContribution; aide: string }> = [
  { valeur: 'lbpc', aide: 'Le groupe Facebook privé, ou lesbonsplanscachers.fr. Recopiez ce qui y est écrit, sans capture.' },
  { valeur: 'autre', aide: 'Une autre source communautaire : dites laquelle dans le texte.' },
];

/** Les classes en toutes lettres : Tailwind ne conserve que les noms qu'il lit dans les sources. */
const CLASSE_ACCENT: Record<1 | 2 | 3 | 4, string> = { 1: 'choix-seuil-1', 2: 'choix-seuil-2', 3: 'choix-seuil-3', 4: 'choix-seuil-4' };

export function ContributionPage() {
  const { ean = '' } = useParams();
  const navigate = useNavigate();
  const adresseFiche = `/produit/${encodeURIComponent(ean)}`;
  const [produit, setProduit] = useState<Pick<Produit, 'nom' | 'marque'> | null>(null);
  const [etape, setEtape] = useState<Etape>(1);
  const [statut, setStatut] = useState<StatutContribution | null>(null);
  const [source, setSource] = useState<SourceContribution>('lbpc');
  const [texte, setTexte] = useState('');
  const [date, setDate] = useState('');
  const [preuve, setPreuve] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [erreurs, setErreurs] = useState<ErreursProposition>({});
  const [envoi, setEnvoi] = useState<Envoi>({ phase: 'saisie', erreur: null });

  // Le nom du produit, pour l'écrire en tête : s'il ne se lit pas, l'EAN suffit (rien ne bloque la saisie).
  useEffect(() => {
    let vivant = true;
    void lire<Produit>(`/api/v1/produits/${encodeURIComponent(ean)}`).then((r) => {
      if (vivant && r.ok) setProduit({ nom: r.data.nom, marque: r.data.marque });
    });
    return () => {
      vivant = false;
    };
  }, [ean]);

  useEffect(() => {
    // Chaque écran commence en haut : une question à la fois.
    window.scrollTo({ top: 0 });
  }, [etape]);

  const aujourdhui = jourLocal();

  const versEtape4 = () => {
    const e = erreursProposition({ sourceTexte: texte, sourceDate: date, preuveUrl: preuve, auteurNom: pseudo }, aujourdhui, HOTES_PREUVE);
    setErreurs(e);
    if (Object.keys(e).length === 0) setEtape(4);
  };

  const envoyerContribution = async () => {
    if (!statut) return;
    setEnvoi({ phase: 'envoi' });
    const r = await envoyer<ContributionProposee>(`/api/v1/produits/${encodeURIComponent(ean)}/contributions`, corpsProposition({ statutPropose: statut, sourceType: source, sourceTexte: texte, sourceDate: date, preuveUrl: preuve, auteurNom: pseudo }));
    if (r.ok) {
      setEnvoi({ phase: 'envoye' });
      return;
    }
    setEnvoi({ phase: 'saisie', erreur: r.statut === 429 ? 'Trop de contributions pour l’instant, réessayez plus tard.' : phraseErreur(r) });
  };

  const barre = (
    <>
      <BoutonRetour to={adresseFiche} />
      <Marque centre />
      <span className="w-tap" aria-hidden="true" />
    </>
  );

  const entete = (
    <>
      <h1 className="text-title font-bold">
        Proposer une contribution
        <Emoji>🤝</Emoji>
      </h1>
      <p className="muet">
        {produit ? (
          <>
            <span className="font-semibold text-text">{produit.nom}</span>
            {produit.marque ? ` · ${produit.marque}` : ''} · EAN {formaterEan(ean)}
          </>
        ) : (
          <>EAN {formaterEan(ean)}</>
        )}
      </p>
    </>
  );

  if (envoi.phase === 'envoye') {
    return (
      <Ecran
        barre={barre}
        pied={
          <BoutonLien to={adresseFiche} variante="primaire" bloc>
            Retour à la fiche
          </BoutonLien>
        }
      >
        {entete}
        <Carte aria-labelledby="titre-merci">
          <h2 id="titre-merci" className="text-18 font-bold">
            Merci !<Emoji>🎉</Emoji>
          </h2>
          <p role="status" className="mt-1">
            Votre contribution attend la validation. La fiche dira « Contribution en attente de validation » jusque-là ; rien ne compte avant.
          </p>
        </Carte>
      </Ecran>
    );
  }

  const indicateur = (
    <p className="muet" aria-live="polite">
      Étape {etape} sur 4
    </p>
  );

  if (etape === 1) {
    return (
      <Ecran
        barre={barre}
        pied={
          <Bouton variante="primaire" bloc aria-disabled={statut ? undefined : 'true'} onClick={() => statut && setEtape(2)}>
            Continuer
          </Bouton>
        }
      >
        {entete}
        {indicateur}
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-3 font-display text-18 font-bold">Que dit la source ?</legend>
          <ul className="flex flex-col gap-3" role="list">
            {STATUTS.map((s) => (
              <li key={s.valeur}>
                <Choix nom="statut" choisi={statut === s.valeur} classe={CLASSE_ACCENT[s.accent]} surChoix={() => setStatut(s.valeur)} titre={s.titre} aide={s.aide} />
              </li>
            ))}
          </ul>
        </fieldset>
      </Ecran>
    );
  }

  if (etape === 2) {
    return (
      <Ecran
        barre={barre}
        pied={
          <>
            <Bouton className="flex-1" onClick={() => setEtape(1)}>
              Retour
            </Bouton>
            <Bouton variante="primaire" className="flex-1" onClick={() => setEtape(3)}>
              Continuer
            </Bouton>
          </>
        }
      >
        {entete}
        {indicateur}
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-3 font-display text-18 font-bold">Quelle est la source ?</legend>
          <ul className="flex flex-col gap-3" role="list">
            {SOURCES.map((s, i) => (
              <li key={s.valeur}>
                <Choix nom="source" choisi={source === s.valeur} classe={CLASSE_ACCENT[i === 0 ? 4 : 3]} surChoix={() => setSource(s.valeur)} titre={SOURCES_CONTRIBUTION[s.valeur].nom} aide={s.aide} />
              </li>
            ))}
          </ul>
        </fieldset>
      </Ecran>
    );
  }

  if (etape === 3) {
    const nbErreurs = Object.keys(erreurs).length;
    return (
      <Ecran
        barre={barre}
        pied={
          <>
            <Bouton className="flex-1" onClick={() => setEtape(2)}>
              Retour
            </Bouton>
            {/* Le bouton du pied SOUMET le formulaire (attribut `form`) : la touche Entrée d'un champ fait pareil, sans second bouton. */}
            <Bouton variante="primaire" className="flex-1" type="submit" form="formulaire-source">
              Continuer
            </Bouton>
          </>
        }
      >
        {entete}
        {indicateur}
        <form
          id="formulaire-source"
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            versEtape4();
          }}
        >
          <h2 className="text-18 font-bold">Ce que dit la source</h2>
          <div>
            <ZoneTexte id="source-texte" etiquette="Texte de la source" aide="Recopiez le message ou la ligne, tel quel. Pas de capture d’écran : un texte, et au besoin un lien." value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={SOURCE_TEXTE_MAX} required aria-invalid={erreurs.sourceTexte ? true : undefined} autoFocus />
            <p className="muet mt-1 text-right" aria-live="polite">
              {texte.trim().length.toLocaleString('fr-FR')} / {SOURCE_TEXTE_MAX.toLocaleString('fr-FR')}
            </p>
            {erreurs.sourceTexte ? <ErreurChamp>{erreurs.sourceTexte}</ErreurChamp> : null}
          </div>
          <div>
            <Champ id="source-date" etiquette="Date de la source (facultatif)" aide="Le jour où la source l’a écrit, au plus tard aujourd’hui." type="date" max={aujourdhui} value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={erreurs.sourceDate ? true : undefined} />
            {erreurs.sourceDate ? <ErreurChamp>{erreurs.sourceDate}</ErreurChamp> : null}
          </div>
          <div>
            <Champ id="preuve" etiquette="Lien de preuve (facultatif)" aide={`Un lien en https vers ${HOTES_PREUVE.join(' ou ')} (le message, la page). Rien d’autre n’est accepté.`} type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://www.facebook.com/…" value={preuve} onChange={(e) => setPreuve(e.target.value)} aria-invalid={erreurs.preuveUrl ? true : undefined} />
            {erreurs.preuveUrl ? <ErreurChamp>{erreurs.preuveUrl}</ErreurChamp> : null}
          </div>
          <div>
            <Champ id="pseudo" etiquette="Pseudonyme (facultatif)" aide="Un pseudonyme, pas votre nom ni votre e-mail. Il s’affichera à côté de la contribution." autoComplete="off" maxLength={AUTEUR_NOM_MAX} value={pseudo} onChange={(e) => setPseudo(e.target.value)} aria-invalid={erreurs.auteurNom ? true : undefined} />
            {erreurs.auteurNom ? <ErreurChamp>{erreurs.auteurNom}</ErreurChamp> : null}
          </div>
          {nbErreurs > 0 ? (
            <Bandeau ton="warn" role="alert">
              {nbErreurs === 1 ? 'Un champ est à corriger avant de continuer.' : `${nbErreurs} champs sont à corriger avant de continuer.`}
            </Bandeau>
          ) : null}
        </form>
      </Ecran>
    );
  }

  const choixStatut = STATUTS.find((s) => s.valeur === statut);
  return (
    <Ecran
      barre={barre}
      pied={
        <>
          <Bouton className="flex-1" disabled={envoi.phase === 'envoi'} onClick={() => setEtape(3)}>
            Modifier
          </Bouton>
          <Bouton variante="accent" accent={1} className="flex-1" disabled={envoi.phase === 'envoi'} onClick={() => void envoyerContribution()}>
            {envoi.phase === 'envoi' ? 'Envoi…' : 'Envoyer'}
          </Bouton>
        </>
      }
    >
      {entete}
      {indicateur}
      <Carte aria-labelledby="titre-recap">
        <h2 id="titre-recap" className="text-18 font-bold">
          Récapitulatif
        </h2>
        <dl className="mt-2 flex flex-col gap-2">
          <Ligne terme="Ce que dit la source">{choixStatut?.titre ?? ''}</Ligne>
          <Ligne terme="Source">{SOURCES_CONTRIBUTION[source].nom}</Ligne>
          <Ligne terme="Texte">
            <span className="whitespace-pre-line">{texte.trim()}</span>
          </Ligne>
          <Ligne terme="Date">{date ? formaterJourCivil(date) : 'non datée'}</Ligne>
          <Ligne terme="Lien de preuve">{preuve.trim() ? <span className="break-all">{preuve.trim()}</span> : 'aucun'}</Ligne>
          <Ligne terme="Pseudonyme">{pseudo.trim() || 'anonyme'}</Ligne>
        </dl>
        <p className="muet mt-3">Votre contribution sera relue à la console avant d’apparaître sur la fiche. Rien n’est gardé sur ce téléphone.</p>
        {envoi.phase === 'saisie' && envoi.erreur ? (
          <Bandeau ton="warn" role="alert" className="mt-3">
            {envoi.erreur}
          </Bandeau>
        ) : null}
      </Carte>
      <button type="button" className="lien self-start" onClick={() => navigate(adresseFiche)}>
        Annuler et revenir à la fiche
      </button>
    </Ecran>
  );
}

/** Une grande carte radio (fond d'accent décoratif, bordure lavande quand choisie, le mot « Choisi » écrit). */
function Choix({ nom, choisi, classe, surChoix, titre, aide }: { nom: string; choisi: boolean; classe: string; surChoix: () => void; titre: string; aide: string }) {
  return (
    <label className={`choix-seuil ${classe} ${choisi ? 'choix-seuil-choisi' : ''}`}>
      <input type="radio" name={nom} checked={choisi} onChange={surChoix} className="cache-visuel" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="font-display text-17 font-bold">{titre}</span>
          {choisi ? <span className="text-small font-bold text-primary-strong">Choisi</span> : null}
        </span>
        <span className="block">{aide}</span>
      </span>
    </label>
  );
}

function ErreurChamp({ children }: { children: string }) {
  return (
    <p className="mt-1 font-semibold text-warn" role="alert">
      {children}
    </p>
  );
}

function Ligne({ terme, children }: { terme: string; children: ReactNode }) {
  return (
    <div>
      <dt className="muet">{terme}</dt>
      <dd className="m-0">{children}</dd>
    </div>
  );
}
