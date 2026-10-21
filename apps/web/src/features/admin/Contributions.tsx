import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { ContributionConsole, EtatContribution } from '@moutar/shared-types';
import { Bandeau } from '../../components/Bandeau';
import { Bouton } from '../../components/Bouton';
import { Champ } from '../../components/Champ';
import { Pastille } from '../../components/Pastille';
import { envoyer } from '../../lib/api';
import { formaterEan, formaterJour, formaterJourCivil } from '../../lib/dates';
import { phraseErreur } from '../../lib/erreurs';
import { nomSource, pastilleContribution } from '../produit/niveau-3-regles';
import { EtatNonLu, useLecture } from './lecture';
import { Filtre, TexteCopiable, type Refus } from './outils';

/*
 * L'onglet « Contributions » de la console (lot 5) : les contributions proposées (défaut), validées ou refusées
 * (`?etat=`), chacune avec son produit nommé (lien vers la fiche), son statut proposé (le mot), sa source, sa date, son
 * texte, son lien de preuve en TEXTE copiable (aucune nouvelle fenêtre : on ne suit pas un lien inconnu depuis la console),
 * son pseudonyme. « Valider » et « Refuser (motif) » se confirment EN PLACE → `PUT` ; 409 `etat_identique` → « Déjà traitée »
 * et la liste se relit. Aucune donnée personnelle (un pseudonyme au plus).
 */

const ETATS: ReadonlyArray<[EtatContribution, string]> = [
  ['proposee', 'Proposées'],
  ['validee', 'Validées'],
  ['refusee', 'Refusées'],
];
const LIBELLE_ETAT: Record<EtatContribution, string> = { proposee: 'En attente', validee: 'Validée', refusee: 'Refusée' };

function etatDepuis(valeur: string | null): EtatContribution {
  return valeur === 'validee' || valeur === 'refusee' ? valeur : 'proposee';
}

export function Contributions({ surRefus }: { surRefus: Refus }) {
  const [params, setParams] = useSearchParams();
  const etatFiltre = etatDepuis(params.get('etat'));
  const { etat, charger, setEtat } = useLecture<ContributionConsole[]>(`/api/v1/admin/contributions?etat=${etatFiltre}`, surRefus);
  const [message, setMessage] = useState<string | null>(null);

  const filtre = (
    <Filtre legende="État" choix={ETATS} valeur={etatFiltre} surChoix={(e) => setParams({ etat: e })} />
  );
  if (etat.phase !== 'ok')
    return (
      <section className="carte flex flex-col gap-3" aria-labelledby="titre-contributions">
        <h1 id="titre-contributions" className="text-17 font-semibold">
          Contributions
        </h1>
        {filtre}
        <EtatNonLu etat={etat} recharger={() => void charger()} />
      </section>
    );

  const retirer = (id: string, phrase: string) => {
    setEtat({ phase: 'ok', data: etat.data.filter((c) => c.id !== id) });
    setMessage(phrase);
  };
  return (
    <section className="carte flex flex-col gap-3" aria-labelledby="titre-contributions">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="titre-contributions" className="text-17 font-semibold">
            Contributions · {etat.data.length} {ETATS.find(([e]) => e === etatFiltre)?.[1].toLowerCase()}
          </h1>
          <p className="muet">Valider écrit la ligne de niveau 3 de la fiche (la plus récente par le jour de sa source) ; refuser la retire. Chaque décision s’écrit au journal.</p>
        </div>
        {filtre}
      </div>
      {message ? (
        <Bandeau ton="info" role="status" className="flex flex-wrap items-center gap-3">
          <span className="flex-1">{message}</span>
          <button type="button" className="lien min-h-[40px]" onClick={() => setMessage(null)}>
            Fermer
          </button>
        </Bandeau>
      ) : null}
      {etat.data.length === 0 ? (
        <p className="muet">Aucune contribution {ETATS.find(([e]) => e === etatFiltre)?.[1].toLowerCase()} pour l’instant.</p>
      ) : (
        <ul className="liste" role="list">
          {etat.data.map((c) => (
            <LigneContribution key={c.id} c={c} surRefus={surRefus} surDecidee={retirer} surDejaTraitee={() => void charger()} />
          ))}
        </ul>
      )}
    </section>
  );
}

type Decision = { quoi: null } | { quoi: 'validee' } | { quoi: 'refusee'; motif: string };

function LigneContribution({ c, surRefus, surDecidee, surDejaTraitee }: { c: ContributionConsole; surRefus: Refus; surDecidee: (id: string, phrase: string) => void; surDejaTraitee: () => void }) {
  const [decision, setDecision] = useState<Decision>({ quoi: null });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const pastille = pastilleContribution(c.statutPropose, c.sourceType);
  const produit = `${c.produit.nom}${c.produit.marque ? ` · ${c.produit.marque}` : ''}`;

  const decider = async (e: FormEvent) => {
    e.preventDefault();
    if (!decision.quoi) return;
    setEnvoi(true);
    setErreur(null);
    const corps = decision.quoi === 'validee' ? { etat: 'validee' } : { etat: 'refusee', motifRefus: decision.motif.trim() || null };
    const r = await envoyer<ContributionConsole>(`/api/v1/admin/contributions/${c.id}`, corps, 'PUT');
    setEnvoi(false);
    if (!r.ok) {
      surRefus(r.statut);
      if (r.code === 'etat_identique') {
        setErreur('Déjà traitée : la liste se recharge.');
        surDejaTraitee();
        return;
      }
      setErreur(phraseErreur(r));
      return;
    }
    surDecidee(c.id, decision.quoi === 'validee' ? `Contribution validée pour « ${produit} » : la fiche la lit dès maintenant.` : `Contribution refusée pour « ${produit} ».`);
  };

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-0 flex-1">
          {c.produit.ean ? (
            <Link to={`/produit/${c.produit.ean}`} className="font-semibold text-text">
              {c.produit.nom}
            </Link>
          ) : (
            <span className="font-semibold">{c.produit.nom}</span>
          )}
          {c.produit.marque ? <span className="muet"> · {c.produit.marque}</span> : null}
          <span className="muet"> · {c.produit.ean ? `EAN ${formaterEan(c.produit.ean)}` : 'sans EAN'}</span>
        </span>
        <Pastille ton={pastille.ton}>{pastille.mot}</Pastille>
        <Pastille ton={c.etat === 'validee' ? 'ok' : c.etat === 'refusee' ? 'neutre' : 'warn'}>{LIBELLE_ETAT[c.etat]}</Pastille>
      </div>
      <p className="muet">
        {nomSource(c.sourceType)} · {c.sourceDate ? `source datée du ${formaterJourCivil(c.sourceDate)}` : 'source non datée'} · proposée le {formaterJour(c.createdAt)}
        {c.auteurNom ? ` · par « ${c.auteurNom} »` : ' · sans pseudonyme'}
        {c.valideeLe ? ` · validée le ${formaterJour(c.valideeLe)}` : ''}
      </p>
      <blockquote className="m-0 whitespace-pre-line rounded-sm border-l-4 border-border bg-surface-2 px-3 py-2">{c.sourceTexte}</blockquote>
      {c.preuveUrl ? <TexteCopiable etiquette="Lien de preuve" texte={c.preuveUrl} /> : <p className="muet">Aucun lien de preuve.</p>}
      {c.etat === 'refusee' && c.motifRefus ? <p className="muet">Motif du refus : {c.motifRefus}</p> : null}
      {decision.quoi === null ? (
        <div className="flex flex-wrap gap-2">
          {c.etat !== 'validee' ? (
            <Bouton variante="primaire" className="min-h-[40px]" onClick={() => setDecision({ quoi: 'validee' })}>
              Valider
            </Bouton>
          ) : null}
          {c.etat !== 'refusee' ? (
            <Bouton className="min-h-[40px]" onClick={() => setDecision({ quoi: 'refusee', motif: '' })}>
              Refuser
            </Bouton>
          ) : null}
        </div>
      ) : (
        <form className="flex flex-col gap-2 rounded-sm border border-border bg-surface-2 p-3" onSubmit={decider}>
          {decision.quoi === 'validee' ? (
            <p className="font-semibold">Valider cette contribution ? La fiche de « {produit} » lira « {pastille.mot} » au niveau 3{c.etat === 'refusee' ? ' (elle avait été refusée)' : ''}.</p>
          ) : (
            <>
              <p className="font-semibold">Refuser cette contribution ?{c.etat === 'validee' ? ' Le verdict de niveau 3 qu’elle fonde sera retiré.' : ' Rien ne s’écrit sur la fiche.'}</p>
              <Champ id={`motif-${c.id}`} etiquette="Motif (facultatif, gardé à la console)" maxLength={500} value={decision.motif} onChange={(e) => setDecision({ quoi: 'refusee', motif: e.target.value })} placeholder="Capture illisible, source introuvable…" autoFocus />
            </>
          )}
          {erreur ? (
            <Bandeau ton="warn" role="alert">
              {erreur}
            </Bandeau>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Bouton type="submit" variante="primaire" className="min-h-[40px]" disabled={envoi}>
              {envoi ? 'Enregistrement…' : decision.quoi === 'validee' ? 'Oui, valider' : 'Oui, refuser'}
            </Bouton>
            <Bouton className="min-h-[40px]" disabled={envoi} onClick={() => setDecision({ quoi: null })}>
              Annuler
            </Bouton>
          </div>
        </form>
      )}
    </li>
  );
}
