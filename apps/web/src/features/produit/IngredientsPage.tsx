import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Produit } from '@moutar/shared-types';
import { Bandeau } from '../../components/Bandeau';
import { Bouton } from '../../components/Bouton';
import { ZoneTexte } from '../../components/Champ';
import { BoutonRetour, Ecran, Marque } from '../../components/Ecran';
import { envoyer } from '../../lib/api';
import { formaterEan } from '../../lib/dates';

/** /produit/:ean/ingredients — lot 1 minimal : coller ou saisir les ingrédients, puis « Analyser » (la photo + OCR : lot 3). */
export function IngredientsPage() {
  const { ean = '' } = useParams();
  const navigate = useNavigate();
  const [texte, setTexte] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const analyser = async (e: FormEvent) => {
    e.preventDefault();
    if (!texte.trim()) {
      setErreur('Saisissez la liste d’ingrédients avant d’analyser.');
      return;
    }
    setEnvoi(true);
    const r = await envoyer<Produit>(`/api/v1/produits/${encodeURIComponent(ean)}/ingredients`, { ingredientsTexte: texte }, 'PUT');
    setEnvoi(false);
    if (!r.ok) {
      setErreur(r.message);
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
      <h1 className="text-title font-bold">Scanner les ingrédients</h1>
      <p className="muet">EAN {formaterEan(ean)}</p>
      <Bandeau ton="info">La photo de l’étiquette et sa lecture automatique arrivent au lot 3. Pour l’instant, recopiez ou collez la liste d’ingrédients : le code croise les additifs avec la table de Moutar.</Bandeau>
      <form className="flex flex-col gap-3" onSubmit={analyser}>
        <ZoneTexte id="ingredients" etiquette="Liste d’ingrédients" aide="Telle qu’elle est écrite sur l’emballage, avec les codes E." value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={5000} autoFocus />
        {erreur ? (
          <Bandeau ton="warn" role="alert">
            {erreur}
          </Bandeau>
        ) : null}
        <Bouton type="submit" variante="primaire" bloc disabled={envoi}>
          {envoi ? 'Analyse…' : 'Analyser'}
        </Bouton>
      </form>
    </Ecran>
  );
}
