import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { EtatSignalement, SignalementConsole } from '@moutar/shared-types';
import { libelleNiveau } from '@moutar/shared-types/regles/niveaux';
import { Bandeau } from '../../components/Bandeau';
import { Bouton } from '../../components/Bouton';
import { Pastille } from '../../components/Pastille';
import { envoyer } from '../../lib/api';
import { formaterEan, formaterJour } from '../../lib/dates';
import { phraseErreur } from '../../lib/erreurs';
import { EtatNonLu, useLecture } from './lecture';
import { Filtre, type Refus } from './outils';

/*
 * L'onglet « Signalements » de la console (lot 5) : ouverts (défaut) ou traités (`?etat=`), chacun avec son produit nommé
 * (lien vers la fiche), le niveau concerné (le mot), le texte, la date ; « Marquer traité » se confirme EN PLACE → `PUT` ;
 * 409 `etat_identique` → « Déjà traité » et la liste se relit. Aucune donnée personnelle.
 */

const ETATS: ReadonlyArray<[EtatSignalement, string]> = [
  ['ouvert', 'Ouverts'],
  ['traite', 'Traités'],
];

export function Signalements({ surRefus }: { surRefus: Refus }) {
  const [params, setParams] = useSearchParams();
  const etatFiltre: EtatSignalement = params.get('etat') === 'traite' ? 'traite' : 'ouvert';
  const { etat, charger, setEtat } = useLecture<SignalementConsole[]>(`/api/v1/admin/signalements?etat=${etatFiltre}`, surRefus);
  const [message, setMessage] = useState<string | null>(null);

  const filtre = <Filtre legende="État" choix={ETATS} valeur={etatFiltre} surChoix={(e) => setParams({ etat: e })} />;
  if (etat.phase !== 'ok')
    return (
      <section className="carte flex flex-col gap-3" aria-labelledby="titre-signalements">
        <h1 id="titre-signalements" className="text-17 font-semibold">
          Signalements
        </h1>
        {filtre}
        <EtatNonLu etat={etat} recharger={() => void charger()} />
      </section>
    );
  return (
    <section className="carte flex flex-col gap-3" aria-labelledby="titre-signalements">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="titre-signalements" className="text-17 font-semibold">
            Signalements · {etat.data.length} {etatFiltre === 'ouvert' ? 'ouverts' : 'traités'}
          </h1>
          <p className="muet">Ce que le public signale sur une ligne de la fiche. Marquer traité ne change rien à la fiche : corrigez-la d’abord (contribution, liste, additif), puis fermez le signalement.</p>
        </div>
        {filtre}
      </div>
      {message ? (
        <Bandeau ton="info" role="status">
          {message}
        </Bandeau>
      ) : null}
      {etat.data.length === 0 ? (
        <p className="muet">Aucun signalement {etatFiltre === 'ouvert' ? 'ouvert' : 'traité'} pour l’instant.</p>
      ) : (
        <ul className="liste" role="list">
          {etat.data.map((s) => (
            <LigneSignalement
              key={s.id}
              s={s}
              surRefus={surRefus}
              surTraite={() => {
                setEtat({ phase: 'ok', data: etat.data.filter((x) => x.id !== s.id) });
                setMessage(`Signalement traité pour « ${s.produit.nom} ».`);
              }}
              surDejaTraite={() => void charger()}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function LigneSignalement({ s, surRefus, surTraite, surDejaTraite }: { s: SignalementConsole; surRefus: Refus; surTraite: () => void; surDejaTraite: () => void }) {
  const [confirmer, setConfirmer] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const traiter = async () => {
    setEnvoi(true);
    setErreur(null);
    const r = await envoyer<SignalementConsole>(`/api/v1/admin/signalements/${s.id}`, { etat: 'traite' }, 'PUT');
    setEnvoi(false);
    if (!r.ok) {
      surRefus(r.statut);
      if (r.code === 'etat_identique') {
        setErreur('Déjà traité : la liste se recharge.');
        surDejaTraite();
        return;
      }
      setErreur(phraseErreur(r));
      return;
    }
    surTraite();
  };

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-0 flex-1">
          {s.produit.ean ? (
            <Link to={`/produit/${s.produit.ean}`} className="font-semibold text-text">
              {s.produit.nom}
            </Link>
          ) : (
            <span className="font-semibold">{s.produit.nom}</span>
          )}
          {s.produit.marque ? <span className="muet"> · {s.produit.marque}</span> : null}
          <span className="muet"> · {s.produit.ean ? `EAN ${formaterEan(s.produit.ean)}` : 'sans EAN'}</span>
        </span>
        <Pastille ton="neutre">{libelleNiveau(s.niveau)}</Pastille>
        <Pastille ton={s.etat === 'ouvert' ? 'warn' : 'ok'}>{s.etat === 'ouvert' ? 'Ouvert' : 'Traité'}</Pastille>
      </div>
      <p className="muet">
        Signalé le {formaterJour(s.createdAt)}
        {s.traiteLe ? ` · traité le ${formaterJour(s.traiteLe)}` : ''}
      </p>
      <blockquote className="m-0 whitespace-pre-line rounded-sm border-l-4 border-border bg-surface-2 px-3 py-2">{s.texte}</blockquote>
      {s.etat === 'ouvert' ? (
        confirmer ? (
          <div className="flex flex-col gap-2 rounded-sm border border-border bg-surface-2 p-3">
            <p className="font-semibold">Marquer ce signalement comme traité ? Il passe dans « Traités » ; la fiche ne change pas.</p>
            {erreur ? (
              <Bandeau ton="warn" role="alert">
                {erreur}
              </Bandeau>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Bouton variante="primaire" className="min-h-[40px]" disabled={envoi} onClick={() => void traiter()}>
                {envoi ? 'Enregistrement…' : 'Oui, traité'}
              </Bouton>
              <Bouton className="min-h-[40px]" disabled={envoi} onClick={() => setConfirmer(false)}>
                Annuler
              </Bouton>
            </div>
          </div>
        ) : (
          <div>
            <Bouton className="min-h-[40px]" onClick={() => setConfirmer(true)}>
              Marquer traité
            </Bouton>
          </div>
        )
      ) : null}
    </li>
  );
}
