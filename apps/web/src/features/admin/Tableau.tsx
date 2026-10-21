import { Link } from 'react-router-dom';
import type { TableauConsole } from '@moutar/shared-types';
import { formaterJourCivil } from '../../lib/dates';
import { EtatNonLu, useLecture } from './lecture';

/*
 * Le tableau de bord de la console (lot 5) : quatre COMPTES, jamais une personne — produits lus, contributions en
 * attente, signalements ouverts, lectures IA du jour (depuis minuit à la pendule du centre, `jour`). Chaque tuile mène à
 * son onglet. Les fonds d'accent sont décoratifs (un par tuile) ; le chiffre n'est jamais une alerte par la seule couleur.
 */

type Refus = (statut: number) => void;
const nombre = (n: number) => n.toLocaleString('fr-FR');

export function Tableau({ surRefus }: { surRefus: Refus }) {
  const { etat, charger } = useLecture<TableauConsole>('/api/v1/admin/tableau', surRefus);
  if (etat.phase !== 'ok') return <EtatNonLu etat={etat} recharger={() => void charger()} />;
  const t = etat.data;
  const tuiles: Array<{ cle: string; valeur: number; titre: string; precision: string; vers: string; classe: string }> = [
    { cle: 'produits', valeur: t.produitsLus, titre: 'Produits lus', precision: 'fiches vivantes', vers: '/admin/produits', classe: 'bg-accent-3-soft' },
    { cle: 'contributions', valeur: t.contributionsEnAttente, titre: 'Contributions en attente', precision: 'à valider ou refuser', vers: '/admin/contributions?etat=proposee', classe: 'bg-accent-2-soft' },
    { cle: 'signalements', valeur: t.signalementsOuverts, titre: 'Signalements ouverts', precision: 'à relire sur la fiche', vers: '/admin/signalements?etat=ouvert', classe: 'bg-accent-1-soft' },
    { cle: 'ia', valeur: t.lecturesIaDuJour, titre: 'Lectures IA du jour', precision: `appels au moteur le ${formaterJourCivil(t.jour)}`, vers: '/admin/journal-ia', classe: 'bg-accent-4-soft' },
  ];
  return (
    <section className="flex flex-col gap-3" aria-labelledby="titre-tableau">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 id="titre-tableau" className="text-17 font-semibold">
          Tableau de bord
        </h1>
        <button type="button" className="lien min-h-[40px]" onClick={() => void charger()}>
          Actualiser
        </button>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="list">
        {tuiles.map((tuile) => (
          <li key={tuile.cle}>
            <Link to={tuile.vers} className={`carte flex min-h-[120px] flex-col justify-between gap-2 no-underline ${tuile.classe}`}>
              <span className="font-display text-[40px] font-extrabold leading-none text-text">{nombre(tuile.valeur)}</span>
              <span className="flex flex-col">
                <span className="font-semibold text-text">{tuile.titre}</span>
                <span className="muet">{tuile.precision}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="muet">Des comptes seulement : la console ne voit aucune personne (il n’y en a pas dans la base). « Du jour » : depuis minuit à l’heure du centre.</p>
    </section>
  );
}
