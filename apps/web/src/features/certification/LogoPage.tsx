import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { CertificationProduit, ResultatLectureLogo, TranscriptionOcr } from '@moutar/shared-types';
import { Bandeau } from '../../components/Bandeau';
import { Bouton, BoutonLien } from '../../components/Bouton';
import { Carte } from '../../components/Carte';
import { BoutonRetour, Ecran, Marque } from '../../components/Ecran';
import { Emoji } from '../../components/Emoji';
import { Pastille } from '../../components/Pastille';
import { appel, lire } from '../../lib/api';
import { formaterEan, formaterJour } from '../../lib/dates';
import { phraseErreur } from '../../lib/erreurs';
import { PropositionsCertificateur } from './PropositionsCertificateur';

/** Ce que `/scan` dépose dans `location.state` (jamais dans l'adresse) : le résultat de la lecture, et l'OCR s'il a suivi. */
export interface EtatLogo {
  resultat?: ResultatLectureLogo;
  transcription?: TranscriptionOcr | null;
  /** « Lire les deux » : le logo est lu mais l'OCR a échoué — la phrase, pour le dire ici. */
  erreurOcr?: string | null;
}

type Actuelle = { phase: 'chargement' } | { phase: 'lue'; certification: CertificationProduit | null } | { phase: 'echec'; message: string };

/**
 * /produit/:ean/logo — les propositions de certificateur après une photo (l'IA propose, l'utilisateur valide d'un clic),
 * ou, sans photo en cours, la certification actuelle et le chemin vers la photo.
 */
export function LogoPage() {
  const { ean = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const etat = (location.state ?? {}) as EtatLogo;
  const adresseScan = `/scan?pour=logo&ean=${encodeURIComponent(ean)}`;

  const suite = useCallback(() => {
    // « Lire les deux » : après le logo, les ingrédients lus attendent leur relecture.
    if (etat.transcription) navigate(`/produit/${ean}/ingredients`, { replace: true, state: { transcription: etat.transcription } });
    else navigate(`/produit/${ean}`, { replace: true });
  }, [ean, etat.transcription, navigate]);

  const barre = (
    <>
      <BoutonRetour to={`/produit/${ean}`} />
      <Marque centre />
      <span className="w-tap" aria-hidden="true" />
    </>
  );

  if (etat.resultat) {
    return (
      <Ecran barre={barre}>
        <h1 className="text-title font-bold">
          Logo de certification
          <Emoji>🏷️</Emoji>
        </h1>
        <p className="muet">EAN {formaterEan(ean)}</p>
        {etat.erreurOcr ? <Bandeau ton="warn">Les ingrédients n’ont pas pu être lus sur cette photo : {etat.erreurOcr} Vous pourrez les photographier depuis la fiche.</Bandeau> : null}
        <PropositionsCertificateur resultat={etat.resultat} ean={ean} surValide={suite} surReprendre={() => navigate(adresseScan, { replace: true })} />
        {etat.transcription ? (
          <button type="button" className="lien self-center" onClick={suite}>
            Passer aux ingrédients lus
          </button>
        ) : null}
      </Ecran>
    );
  }
  return <CertificationActuelle ean={ean} barre={barre} adresseScan={adresseScan} />;
}

/** Sans photo en cours : ce qui est retenu aujourd'hui (ou rien), « Retirer » avec confirmation en place, et la photo. */
function CertificationActuelle({ ean, barre, adresseScan }: { ean: string; barre: React.ReactNode; adresseScan: string }) {
  const [actuelle, setActuelle] = useState<Actuelle>({ phase: 'chargement' });
  const [confirmer, setConfirmer] = useState(false);
  const [retrait, setRetrait] = useState<{ envoi: boolean; erreur: string | null }>({ envoi: false, erreur: null });

  const charger = useCallback(async () => {
    setActuelle({ phase: 'chargement' });
    const r = await lire<CertificationProduit | null>(`/api/v1/produits/${encodeURIComponent(ean)}/certification`);
    if (r.ok) setActuelle({ phase: 'lue', certification: r.data ?? null });
    else setActuelle({ phase: 'echec', message: phraseErreur(r) });
  }, [ean]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const retirer = async () => {
    setRetrait({ envoi: true, erreur: null });
    const r = await appel<{ ok: true }>(`/api/v1/produits/${encodeURIComponent(ean)}/certification`, { method: 'DELETE' });
    if (!r.ok && r.code !== 'certification_absente') {
      setRetrait({ envoi: false, erreur: phraseErreur(r) });
      return;
    }
    setRetrait({ envoi: false, erreur: null });
    setConfirmer(false);
    setActuelle({ phase: 'lue', certification: null });
  };

  return (
    <Ecran
      barre={barre}
      pied={
        <BoutonLien to={adresseScan} variante="accent" accent={1} bloc>
          Photographier le logo
        </BoutonLien>
      }
    >
      <h1 className="text-title font-bold">
        Logo de certification
        <Emoji>🏷️</Emoji>
      </h1>
      <p className="muet">EAN {formaterEan(ean)}</p>
      <p>Photographiez le logo de l’emballage : Moutar propose l’organisme qu’il reconnaît, vous validez d’un clic. Le verdict vient du catalogue, jamais de la photo seule.</p>
      {actuelle.phase === 'chargement' ? (
        <p className="muet" role="status">
          Lecture de la certification…
        </p>
      ) : actuelle.phase === 'echec' ? (
        <Carte className="synthese-warn">
          <div className="mb-2 flex flex-wrap items-center gap-x-[10px] gap-y-2">
            <h2 className="flex-1 text-18 font-bold">Certification non lue</h2>
            <Pastille ton="warn">Non lu</Pastille>
          </div>
          <p>{actuelle.message}</p>
          <Bouton variante="primaire" bloc className="mt-3" onClick={() => void charger()}>
            Réessayer
          </Bouton>
        </Carte>
      ) : actuelle.certification ? (
        <Carte aria-labelledby="titre-actuelle">
          <div className="mb-2 flex flex-wrap items-center gap-x-[10px] gap-y-2">
            <h2 id="titre-actuelle" className="flex-auto text-18 font-bold">
              Retenue aujourd’hui
            </h2>
            {actuelle.certification.certificateurActif ? <Pastille ton="ok">{`Certifié · ${actuelle.certification.nomCourt}`}</Pastille> : <Pastille ton="warn">Non vérifié</Pastille>}
          </div>
          <p>
            <span className="font-semibold">{actuelle.certification.nom}</span>
            {actuelle.certification.mentionsLibelles.length > 0 ? ` · ${actuelle.certification.mentionsLibelles.join(', ')}` : ''}
          </p>
          <p className="muet mt-1">
            Validée par vous le {formaterJour(actuelle.certification.publieLe)}
            {actuelle.certification.texteLu ? ` · texte lu : « ${actuelle.certification.texteLu} »` : ''}
            {actuelle.certification.certificateurActif ? '' : ' · organisme désactivé à la console depuis : la certification ne compte plus.'}
          </p>
          {confirmer ? (
            <Bandeau ton="warn" role="alert" className="mt-3">
              <p className="font-semibold">Retirer cette certification ?</p>
              <p>La ligne du niveau 1 redevient « Aucun logo lu ». Vous pourrez reprendre une photo.</p>
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
          ) : (
            <Bouton bloc className="mt-3" onClick={() => setConfirmer(true)}>
              Retirer
            </Bouton>
          )}
        </Carte>
      ) : (
        <Carte>
          <div className="mb-2 flex flex-wrap items-center gap-x-[10px] gap-y-2">
            <h2 className="flex-auto text-18 font-bold">Retenue aujourd’hui</h2>
            <Pastille ton="neutre">Aucun logo lu</Pastille>
          </div>
          <p>Aucune certification validée pour ce produit.</p>
        </Carte>
      )}
    </Ecran>
  );
}
