import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { Produit, SourceIngredients, TranscriptionOcr } from '@moutar/shared-types';
import { Bandeau } from '../../components/Bandeau';
import { Bouton, BoutonLien } from '../../components/Bouton';
import { ZoneTexte } from '../../components/Champ';
import { BoutonRetour, Ecran, Marque } from '../../components/Ecran';
import { Emoji } from '../../components/Emoji';
import { Pastille } from '../../components/Pastille';
import { envoyer } from '../../lib/api';
import { formaterEan } from '../../lib/dates';
import { phraseErreur } from '../../lib/erreurs';
import { confianceEnMots } from '../certification/confiance-en-mots';

/** La même borne que le serveur (`INGREDIENTS_MAX`, `PUT …/ingredients`) et que l'OCR : 10 000 caractères. */
const INGREDIENTS_MAX = 10_000;

/** Ce que `/scan` dépose dans `location.state` après l'OCR (jamais dans l'adresse) : la transcription, SANS écriture. */
export interface EtatIngredients {
  transcription?: TranscriptionOcr | null;
}

/**
 * /produit/:ean/ingredients — la liste d'ingrédients : lue sur une photo (OCR, lot 3) puis RELUE ici avant d'être
 * enregistrée (`PUT …/ingredients` avec `source: 'ocr'`), ou saisie à la main. L'analyse des additifs se fait ensuite
 * par le code, sur la carte.
 */
export function IngredientsPage() {
  const { ean = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const transcription = ((location.state ?? {}) as EtatIngredients).transcription ?? null;
  const lueSurPhoto = transcription !== null && transcription.lisible && transcription.texte.trim() !== '';
  const [texte, setTexte] = useState(lueSurPhoto ? transcription.texte : '');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const adresseScan = `/scan?pour=ingredients&ean=${encodeURIComponent(ean)}`;
  // Un texte lu sur la photo reste « ocr » même retouché : c'est ce qui soustrait la fiche à la relecture silencieuse d'OFF.
  const source: SourceIngredients = lueSurPhoto ? 'ocr' : 'manuel';

  const analyser = async (e: FormEvent) => {
    e.preventDefault();
    if (!texte.trim()) {
      setErreur('Saisissez la liste d’ingrédients avant d’analyser.');
      return;
    }
    setEnvoi(true);
    const r = await envoyer<Produit>(`/api/v1/produits/${encodeURIComponent(ean)}/ingredients`, { ingredientsTexte: texte, source }, 'PUT');
    setEnvoi(false);
    if (!r.ok) {
      setErreur(phraseErreur(r));
      return;
    }
    navigate(`/produit/${ean}`, { replace: true });
  };

  return (
    <Ecran
      barre={
        <>
          <BoutonRetour to={`/produit/${ean}`} />
          <Marque centre />
          <span className="w-tap" aria-hidden="true" />
        </>
      }
    >
      <h1 className="text-title font-bold">
        Scanner les ingrédients
        <Emoji>🧾</Emoji>
      </h1>
      <p className="muet">EAN {formaterEan(ean)}</p>
      {transcription && !lueSurPhoto ? (
        <Bandeau ton="warn" role="alert">
          <p className="font-semibold">Étiquette illisible, reprenez la photo.</p>
          <p>Aucune liste d’ingrédients lisible sur cette image : recadrez, rapprochez-vous, évitez les reflets. Vous pouvez aussi saisir le texte à la main.</p>
        </Bandeau>
      ) : null}
      {lueSurPhoto ? (
        <div className="flex flex-wrap items-center gap-x-[10px] gap-y-2">
          <p className="flex-auto font-semibold">Lu sur la photo · relisez avant d’enregistrer</p>
          <Pastille ton="neutre">{`Confiance : ${confianceEnMots(transcription.confiance)}`}</Pastille>
        </div>
      ) : (
        <p>Photographiez la liste d’ingrédients : le texte lu s’affiche ici, vous le relisez, puis le code croise les additifs avec la table de Moutar, ligne par ligne. Ou recopiez-la.</p>
      )}
      <BoutonLien to={adresseScan} variante={lueSurPhoto ? 'defaut' : 'accent'} accent={1} bloc>
        {lueSurPhoto ? 'Reprendre la photo' : 'Photographier l’étiquette'}
      </BoutonLien>
      <form className="flex flex-col gap-3" onSubmit={analyser}>
        <ZoneTexte
          id="ingredients"
          etiquette="Liste d’ingrédients"
          aide={lueSurPhoto ? 'Corrigez ce que la lecture a mal lu : un mot illisible est écrit « [illisible] ». Les codes E ont été remis en forme (E120, E322).' : 'Telle qu’elle est écrite sur l’emballage, avec les codes E.'}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          maxLength={INGREDIENTS_MAX}
          autoFocus={!lueSurPhoto}
          className={lueSurPhoto ? 'min-h-[260px]' : ''}
        />
        {lueSurPhoto && transcription.texteBrut && transcription.texteBrut !== transcription.texte ? (
          <details>
            <summary className="lien cursor-pointer list-none">Voir le texte lu tel quel</summary>
            <p className="muet mt-1 whitespace-pre-wrap">{transcription.texteBrut}</p>
          </details>
        ) : null}
        {erreur ? (
          <Bandeau ton="warn" role="alert">
            {erreur}
          </Bandeau>
        ) : null}
        <Bouton type="submit" variante="accent" accent={1} bloc disabled={envoi}>
          {envoi ? 'Enregistrement…' : lueSurPhoto ? 'Enregistrer et analyser' : 'Analyser les ingrédients'}
        </Bouton>
      </form>
    </Ecran>
  );
}
