import { useState } from 'react';
import type { CertificationProduit, MentionCertification, PropositionCertificateur, ResultatLectureLogo } from '@moutar/shared-types';
import { CERTIFICATEURS_PAR_CODE, LIBELLES_MENTIONS_CERTIFICATION, MENTIONS_CERTIFICATION } from '@moutar/shared-types/catalogues/certificateurs';
import { Bandeau } from '../../components/Bandeau';
import { Bouton } from '../../components/Bouton';
import { Carte } from '../../components/Carte';
import { Emoji } from '../../components/Emoji';
import { Pastille } from '../../components/Pastille';
import { envoyer } from '../../lib/api';
import { phraseErreur } from '../../lib/erreurs';
import { confianceEnMots } from './confiance-en-mots';

/**
 * Ce que l'IA PROPOSE après la lecture d'un logo ; l'utilisateur VALIDE d'un clic (« C'est bien ce logo ») — rien n'est
 * écrit avant. Sans produit identifié (`ean` null), la liste se lit seulement : on propose d'associer un produit.
 * Jamais un verdict ici : la confiance s'écrit en mots, dans une pastille neutre ; « aucun » n'est jamais rouge.
 */
export function PropositionsCertificateur({
  resultat,
  ean,
  surValide,
  surReprendre,
  surAssocier,
}: {
  resultat: ResultatLectureLogo;
  /** Le produit auquel rattacher la certification ; null = lecture sans produit (rien à valider). */
  ean: string | null;
  surValide?: (certification: CertificationProduit) => void;
  surReprendre: () => void;
  /** Sans produit : « Associer à un produit : photographiez son code-barres ». */
  surAssocier?: () => void;
}) {
  const [refus, setRefus] = useState(false);

  if (resultat.aucun || resultat.propositions.length === 0) {
    return (
      <Carte aria-labelledby="titre-logo">
        <div className="mb-2 flex flex-wrap items-center gap-x-[10px] gap-y-2">
          <h2 id="titre-logo" className="flex-auto text-18 font-bold">
            Logo de certification
            <Emoji>🔎</Emoji>
          </h2>
          <Pastille ton="neutre">Aucun logo lu</Pastille>
        </div>
        <p>Aucun logo de certification lu sur la photo. Ce n’est pas un « non cacher » : le logo est peut-être petit, de biais ou mal éclairé.</p>
        <SymbolesInconnus symboles={resultat.candidatsNonReconnus} />
        <div className="mt-3 flex flex-col gap-2">
          <Bouton variante="accent" accent={1} bloc onClick={surReprendre}>
            Reprendre la photo
          </Bouton>
        </div>
      </Carte>
    );
  }

  if (refus) {
    return (
      <Carte aria-labelledby="titre-logo">
        <div className="mb-2 flex flex-wrap items-center gap-x-[10px] gap-y-2">
          <h2 id="titre-logo" className="flex-auto text-18 font-bold">
            Logo de certification
            <Emoji>🔎</Emoji>
          </h2>
          <Pastille ton="neutre">Non retenu</Pastille>
        </div>
        <p role="status">Le logo n’est pas reconnu : la certification n’est pas retenue. Rien n’a été écrit.</p>
        <div className="mt-3 flex flex-col gap-2">
          <Bouton variante="accent" accent={1} bloc onClick={surReprendre}>
            Reprendre la photo
          </Bouton>
          <Bouton bloc onClick={() => setRefus(false)}>
            Revoir les propositions
          </Bouton>
        </div>
      </Carte>
    );
  }

  return (
    <Carte aria-labelledby="titre-logo">
      <h2 id="titre-logo" className="text-18 font-bold">
        {resultat.propositions.length > 1 ? 'Logos proposés' : 'Logo proposé'}
        <Emoji>🔎</Emoji>
      </h2>
      <p className="muet mb-1">{ean ? 'Moutar propose, vous validez : rien n’est écrit avant votre clic.' : 'Moutar propose ; pour retenir une certification, le produit doit d’abord être identifié.'}</p>
      <ol className="liste" role="list">
        {resultat.propositions.map((p, i) => (
          <Proposition key={p.code} proposition={p} ean={ean} enAvant={i === 0} surValide={surValide} />
        ))}
      </ol>
      <SymbolesInconnus symboles={resultat.candidatsNonReconnus} />
      <div className="mt-3 flex flex-col gap-2">
        {ean ? (
          <Bouton bloc onClick={() => setRefus(true)}>
            Aucun de ceux-là
          </Bouton>
        ) : surAssocier ? (
          <Bouton variante="accent" accent={1} bloc onClick={surAssocier}>
            Associer à un produit : photographiez son code-barres
          </Bouton>
        ) : null}
        <button type="button" className="lien self-center" onClick={surReprendre}>
          Reprendre la photo
        </button>
      </div>
    </Carte>
  );
}

/** Les mentions qu'un organisme peut porter (catalogue en code) ; un organisme hors catalogue : toutes. */
function mentionsPossibles(code: string): readonly MentionCertification[] {
  return CERTIFICATEURS_PAR_CODE.get(code)?.mentionsPossibles ?? MENTIONS_CERTIFICATION;
}

function Proposition({ proposition: p, ean, enAvant, surValide }: { proposition: PropositionCertificateur; ean: string | null; enAvant: boolean; surValide?: (c: CertificationProduit) => void }) {
  const [mentions, setMentions] = useState<MentionCertification[]>(p.mentions);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const possibles = mentionsPossibles(p.code);
  const idBase = `proposition-${p.code}`;

  const valider = async () => {
    if (!ean) return;
    setEnvoi(true);
    setErreur(null);
    const r = await envoyer<CertificationProduit>(`/api/v1/produits/${encodeURIComponent(ean)}/certification`, { code: p.code, mentions, texteLu: p.texteLu });
    setEnvoi(false);
    if (!r.ok) {
      setErreur(phraseErreur(r));
      return;
    }
    surValide?.(r.data);
  };

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-[10px] gap-y-[6px]">
        <p className="min-w-0 flex-auto">
          <span className="font-display text-17 font-bold">{p.nom}</span>
          <span className="muet block">
            Lu sur la photo : « {p.texteLu} »{enAvant ? ' · proposition la plus sûre' : ''}
          </span>
        </p>
        <Pastille ton="neutre" className="max-w-full">
          {`Confiance : ${confianceEnMots(p.confiance)}`}
        </Pastille>
      </div>
      {possibles.length > 0 ? (
        <fieldset className="m-0 mt-2 border-0 p-0">
          <legend className="font-semibold">Mentions sur le logo</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {possibles.map((m) => {
              const id = `${idBase}-${m}`;
              const cochee = mentions.includes(m);
              return (
                <label key={m} htmlFor={id} className="inline-flex min-h-tap cursor-pointer items-center gap-2">
                  <input
                    id={id}
                    type="checkbox"
                    className="h-5 w-5 accent-primary"
                    checked={cochee}
                    disabled={!ean || envoi}
                    onChange={() => setMentions(cochee ? mentions.filter((x) => x !== m) : [...mentions, m])}
                  />
                  {LIBELLES_MENTIONS_CERTIFICATION[m]}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
      {erreur ? (
        <Bandeau ton="warn" role="alert" className="mt-2">
          {erreur}
        </Bandeau>
      ) : null}
      {ean ? (
        <Bouton variante={enAvant ? 'accent' : 'defaut'} accent={1} bloc className="mt-2" disabled={envoi} onClick={() => void valider()}>
          {envoi ? 'Validation…' : `C’est bien ce logo${enAvant ? '' : ` (${p.nomCourt})`}`}
        </Bouton>
      ) : null}
    </li>
  );
}

/** Les symboles lus qui ne correspondent à rien du catalogue : montrés, jamais interprétés. */
function SymbolesInconnus({ symboles }: { symboles: string[] }) {
  if (symboles.length === 0) return null;
  return (
    <p className="muet mt-2">
      {symboles.length > 1 ? 'Symboles lus, inconnus du catalogue : ' : 'Symbole lu, inconnu du catalogue : '}
      {symboles.map((s, i) => (
        <span key={`${s}-${i}`}>
          {i > 0 ? ', ' : ''}« {s} »
        </span>
      ))}
      . Vous pourrez le signaler au lot 5.
    </p>
  );
}
