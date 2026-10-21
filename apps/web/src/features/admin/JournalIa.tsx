import { Link, useSearchParams } from 'react-router-dom';
import type { LigneJournalIa, PageJournalIa } from '@moutar/shared-types';
import { Pastille } from '../../components/Pastille';
import { pluriel } from '../../lib/texte';
import { EtatNonLu, useLecture } from './lecture';
import type { Refus } from './outils';

/*
 * L'onglet « Journal IA » de la console (lot 5) : `journal_ia` en lecture seule, 50 lignes par page (`?page=`), les plus
 * récentes d'abord — date, fournisseur, modèle, usage, durée, issue, code d'erreur, jetons. AUCUNE colonne de contenu : le
 * journal n'en garde pas (ni image, ni texte, ni identité). Un échec est ambre (jamais rouge : rien de « non cacher » ici).
 */

const USAGES: Record<LigneJournalIa['usage'], string> = { lecture_logo: 'Lecture d’un logo', ocr_ingredients: 'OCR des ingrédients', transcription: 'Transcription (dictée)' };
const QUAND = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });

/** « 850 ms », « 1,2 s ». */
export function formaterDuree(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`;
}

export function JournalIa({ surRefus }: { surRefus: Refus }) {
  const [params] = useSearchParams();
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const { etat, charger } = useLecture<PageJournalIa>(`/api/v1/admin/journal-ia?page=${page}`, surRefus);
  if (etat.phase !== 'ok') return <EtatNonLu etat={etat} recharger={() => void charger()} />;
  const { lignes, total, parPage } = etat.data;
  const pages = Math.max(1, Math.ceil(total / parPage));
  const pagination = (
    <nav aria-label="Pages du journal IA" className="flex flex-wrap items-center gap-3">
      {page > 1 ? (
        <Link to={`/admin/journal-ia?page=${page - 1}`} className="btn min-h-[40px]">
          Page précédente
        </Link>
      ) : null}
      <span className="muet">
        Page {page} sur {pages} · {pluriel(total, 'ligne', 'lignes')}
      </span>
      {page < pages ? (
        <Link to={`/admin/journal-ia?page=${page + 1}`} className="btn min-h-[40px]">
          Page suivante
        </Link>
      ) : null}
    </nav>
  );
  return (
    <section className="carte flex flex-col gap-3" aria-labelledby="titre-journal-ia">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="titre-journal-ia" className="text-17 font-semibold">
            Journal IA · {pluriel(total, 'appel', 'appels')} au moteur
          </h1>
          <p className="muet">En ajout seul, sans contenu : ni image, ni texte, ni identité n’y sont gardés — des durées, des codes et des comptes de jetons.</p>
        </div>
        {pagination}
      </div>
      {lignes.length === 0 ? (
        <p className="muet">{page > 1 ? 'Cette page est vide : revenez à la première.' : 'Aucun appel au moteur pour l’instant.'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Date
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Fournisseur
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Modèle
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Usage
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Durée
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Issue
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Code d’erreur
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Jetons
                </th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id} className="border-b border-border align-top">
                  <td className="whitespace-nowrap py-2 pr-3">{QUAND.format(new Date(l.createdAt))}</td>
                  <td className="py-2 pr-3">{l.fournisseur}</td>
                  <td className="whitespace-nowrap py-2 pr-3">{l.modele}</td>
                  <td className="py-2 pr-3">{USAGES[l.usage] ?? l.usage}</td>
                  <td className="whitespace-nowrap py-2 pr-3">{formaterDuree(l.dureeMs)}</td>
                  <td className="py-2 pr-3">
                    <Pastille ton={l.ok ? 'ok' : 'warn'}>{l.ok ? 'OK' : 'Échec'}</Pastille>
                  </td>
                  <td className="py-2 pr-3">{l.erreur ? <code className="text-small">{l.erreur}</code> : <span className="muet">—</span>}</td>
                  <td className="whitespace-nowrap py-2">{l.jetonsEntree === null && l.jetonsSortie === null ? <span className="muet">non comptés</span> : `${l.jetonsEntree ?? '?'} → ${l.jetonsSortie ?? '?'}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lignes.length > 0 ? pagination : null}
    </section>
  );
}
