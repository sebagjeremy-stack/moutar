import { Link, useSearchParams } from 'react-router-dom';
import type { LigneJournalProduit, PageJournalProduit } from '@moutar/shared-types';
import { formaterEan } from '../../lib/dates';
import { pluriel } from '../../lib/texte';
import { EtatNonLu, useLecture } from './lecture';
import type { Refus } from './outils';

/*
 * L'onglet « Journal produits » de la console (21/10/2026) : `journal_produit` en lecture seule, 50 lignes par page
 * (`?page=`), les plus récentes d'abord — date, produit (lien vers la fiche), geste, source déclarée, longueur et empreinte
 * du texte écrit. JAMAIS le texte lui-même : le journal n'en garde pas. Aucune donnée personnelle (il n'y en a pas).
 */

const ACTIONS: Record<LigneJournalProduit['action'], string> = { 'ingredients.ecriture': 'Ingrédients réécrits', 'produit.creation': 'Fiche créée à la main' };
const SOURCES: Record<string, string> = { manuel: 'saisie', ocr: 'OCR relu' };
const QUAND = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });

export function JournalProduits({ surRefus }: { surRefus: Refus }) {
  const [params] = useSearchParams();
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const { etat, charger } = useLecture<PageJournalProduit>(`/api/v1/admin/journal-produits?page=${page}`, surRefus);
  if (etat.phase !== 'ok') return <EtatNonLu etat={etat} recharger={() => void charger()} />;
  const { lignes, total, parPage } = etat.data;
  const pages = Math.max(1, Math.ceil(total / parPage));
  const pagination = (
    <nav aria-label="Pages du journal des produits" className="flex flex-wrap items-center gap-3">
      {page > 1 ? (
        <Link to={`/admin/journal-produits?page=${page - 1}`} className="btn min-h-[40px]">
          Page précédente
        </Link>
      ) : null}
      <span className="muet">
        Page {page} sur {pages} · {pluriel(total, 'ligne', 'lignes')}
      </span>
      {page < pages ? (
        <Link to={`/admin/journal-produits?page=${page + 1}`} className="btn min-h-[40px]">
          Page suivante
        </Link>
      ) : null}
    </nav>
  );
  return (
    <section className="carte flex flex-col gap-3" aria-labelledby="titre-journal-produits">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="titre-journal-produits" className="text-17 font-semibold">
            Journal produits · {pluriel(total, 'écriture publique', 'écritures publiques')}
          </h1>
          <p className="muet">Chaque fiche créée à la main et chaque réécriture des ingrédients, en ajout seul. Le texte n’y est pas : sa longueur et son empreinte seulement (deux textes identiques ont la même empreinte).</p>
        </div>
        {pagination}
      </div>
      {lignes.length === 0 ? (
        <p className="muet">{page > 1 ? 'Cette page est vide : revenez à la première.' : 'Aucune écriture publique pour l’instant.'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Date
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Produit
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Geste
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Source
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Longueur
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Empreinte
                </th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id} className="border-b border-border align-top">
                  <td className="whitespace-nowrap py-2 pr-3">{QUAND.format(new Date(l.createdAt))}</td>
                  <td className="py-2 pr-3">
                    {l.produit ? (
                      <>
                        {l.produit.ean ? (
                          <Link to={`/produit/${l.produit.ean}`} className="font-semibold text-text">
                            {l.produit.nom}
                          </Link>
                        ) : (
                          <span className="font-semibold">{l.produit.nom}</span>
                        )}
                        <span className="muet"> · {l.produit.ean ? `EAN ${formaterEan(l.produit.ean)}` : 'sans EAN'}</span>
                      </>
                    ) : (
                      <span className="muet">fiche introuvable</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{ACTIONS[l.action] ?? l.action}</td>
                  <td className="py-2 pr-3">{SOURCES[l.source] ?? l.source}</td>
                  <td className="whitespace-nowrap py-2 pr-3">{pluriel(l.longueur, 'caractère', 'caractères')}</td>
                  <td className="py-2">
                    <code className="text-small" title={l.empreinte}>
                      {l.empreinte.slice(0, 12)}…
                    </code>
                  </td>
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
