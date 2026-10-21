import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CodeListe, LigneAnalysee, LigneListe, ListeOfficielle } from '@moutar/shared-types';
import { libelleMention } from '@moutar/shared-types/catalogues/rubriques-listes';
import { Bandeau } from '../../components/Bandeau';
import { Bouton } from '../../components/Bouton';
import { Champ, ZoneTexte } from '../../components/Champ';
import { Pastille } from '../../components/Pastille';
import { appel, envoyer } from '../../lib/api';
import { formaterJour, formaterJourCivil, jourLocal } from '../../lib/dates';
import { phraseErreur } from '../../lib/erreurs';
import { pluriel } from '../../lib/texte';
import { CODES_LISTES, LIBELLE_CODE } from '../../lib/listes';
import { EtatNonLu, useLecture } from './lecture';
import { incoherenceLigne, numerosIncoherents, rubriqueReservee } from './lignes-regles';

/*
 * L'onglet « Listes » de la console (lot 2) : les éditions importées, l'import d'une édition (aperçu analysé, lignes
 * corrigées en place, puis import), et la page d'une liste (ses lignes, recherche, édition en place, retrait doux avec
 * confirmation EN PLACE, ajout manuel, activation, dates). Aucune donnée personnelle ici. Desktop toléré, mêmes jetons.
 */

type Refus = (statut: number) => void;
type Apercu = { lignes: LigneAnalysee[]; avertissements: string[]; note: string | null; fichierNom: string | null };
type ReponseLignes = { liste: ListeOfficielle; compte: number; lignes: LigneListe[]; tronque?: boolean };

const LIGNES_PAR_PAGE = 200;
/** Le texte collé d'une liste : 1 000 000 caractères au plus (≈ 1 Mo, la limite du corps JSON) ; au-delà, le fichier. */
const MAX_TEXTE_COLLE = 1_000_000;
const nombre = (n: number) => n.toLocaleString('fr-FR');

/** « publiée le 01/07/2025 · valable jusqu’au 31/07/2026 », ou leur absence, dite. */
function datesListe(l: Pick<ListeOfficielle, 'publieLe' | 'valableJusquAu'>): string {
  return [l.publieLe ? `publiée le ${formaterJourCivil(l.publieLe)}` : 'date de publication non indiquée', l.valableJusquAu ? `valable jusqu’au ${formaterJourCivil(l.valableJusquAu)}` : 'sans date de fin annoncée'].join(' · ');
}

const validitePassee = (l: Pick<ListeOfficielle, 'valableJusquAu'>) => Boolean(l.valableJusquAu && l.valableJusquAu < jourLocal());

function PastillesListe({ liste }: { liste: ListeOfficielle }) {
  return (
    <>
      <Pastille ton={liste.active ? 'ok' : 'neutre'}>{liste.active ? 'Active' : 'Inactive'}</Pastille>
      {validitePassee(liste) ? <Pastille ton="warn">Validité passée</Pastille> : null}
    </>
  );
}

/* ---------- La liste des listes ---------- */

export function Listes({ surRefus }: { surRefus: Refus }) {
  const { etat, charger } = useLecture<{ compte: number; listes: ListeOfficielle[] }>('/api/v1/admin/listes', surRefus);
  const [importOuvert, setImportOuvert] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  if (etat.phase !== 'ok') return <EtatNonLu etat={etat} recharger={() => void charger()} />;
  return (
    <section className="carte flex flex-col gap-3" aria-labelledby="titre-listes">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="titre-listes" className="text-17 font-semibold">
            Listes officielles · {pluriel(etat.data.compte, 'édition', 'éditions')}
          </h1>
          <p className="muet">Une seule édition active par liste : importer une édition neuve désactive l’ancienne, qui reste lisible. Chaque import s’écrit au journal.</p>
        </div>
        <Bouton variante="primaire" aria-expanded={importOuvert} aria-controls="import-liste" onClick={() => setImportOuvert(!importOuvert)}>
          {importOuvert ? 'Fermer l’import' : 'Importer une liste'}
        </Bouton>
      </div>
      {importOuvert ? (
        <ImportListe
          surRefus={surRefus}
          surAnnule={() => setImportOuvert(false)}
          surImporte={(l) => {
            setImportOuvert(false);
            setConfirmation(`Liste importée : « ${l.titre} », ${pluriel(l.nombreLignes, 'ligne', 'lignes')}, active.`);
            void charger();
          }}
        />
      ) : null}
      {confirmation ? (
        <Bandeau ton="info" role="status">
          {confirmation}
        </Bandeau>
      ) : null}
      {etat.data.listes.length === 0 ? (
        <p className="muet">Aucune liste importée pour l’instant : les cartes disent « Non vérifié · aucune liste importée » au niveau 2.</p>
      ) : (
        <ul className="liste" role="list">
          {etat.data.listes.map((l) => (
            <li key={l.id} className={`py-[10px] ${l.active ? '' : 'text-muted'}`}>
              <p className="muet font-semibold">{LIBELLE_CODE[l.code]}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link to={`/admin/listes/${l.id}`} className="lien min-w-0 flex-1 text-left">
                  {l.titre}
                </Link>
                <PastillesListe liste={l} />
              </div>
              <p className="muet mt-1">
                {datesListe(l)} · {pluriel(l.nombreLignes, 'ligne', 'lignes')} · importée le {formaterJour(l.importeLe)}
                {l.fichierNom ? ` · ${l.fichierNom}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- L'import : source, aperçu corrigé, import ---------- */

function ImportListe({ surRefus, surImporte, surAnnule }: { surRefus: Refus; surImporte: (l: ListeOfficielle) => void; surAnnule: () => void }) {
  const [code, setCode] = useState<CodeListe>('consistoire_paris');
  const [titre, setTitre] = useState('');
  const [publieLe, setPublieLe] = useState('');
  const [valableJusquAu, setValableJusquAu] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const [texte, setTexte] = useState('');
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [lignes, setLignes] = useState<LigneAnalysee[]>([]);
  const [note, setNote] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState<'aucun' | 'apercu' | 'import'>('aucun');

  const analyser = async (e: FormEvent) => {
    e.preventDefault();
    setErreur(null);
    if (!fichier && !texte.trim()) {
      setErreur('Choisissez un fichier (PDF, texte ou CSV) ou collez le texte de la liste.');
      return;
    }
    setEnvoi('apercu');
    let r;
    // Le titre, s'il est déjà saisi, part avec l'aperçu : l'analyse ignore les lignes qui lui sont égales (en-tête répété).
    if (fichier) {
      const fd = new FormData();
      fd.append('code', code);
      if (titre.trim()) fd.append('titre', titre.trim());
      fd.append('fichier', fichier);
      r = await appel<Apercu>('/api/v1/admin/listes/apercu', { method: 'POST', body: fd });
    } else {
      r = await envoyer<Apercu>('/api/v1/admin/listes/apercu', { code, texte, titre: titre.trim() || null });
    }
    setEnvoi('aucun');
    if (!r.ok) {
      surRefus(r.statut);
      setErreur(phraseErreur(r));
      return;
    }
    setApercu(r.data);
    setLignes(r.data.lignes.map((l) => ({ ...l, mention: libelleMention(l.mention) })));
    setNote(r.data.note ?? '');
  };

  const importer = async () => {
    setErreur(null);
    if (!titre.trim()) {
      setErreur('Le titre de la liste est obligatoire (ex. « Consistoire de Paris — Produits 2025-2026 »).');
      return;
    }
    const incoherentes = numerosIncoherents(lignes);
    if (incoherentes.length) {
      setErreur(`Corrigez d’abord les lignes incohérentes : ${incoherentes.slice(0, 10).join(', ')}${incoherentes.length > 10 ? '…' : ''}.`);
      return;
    }
    setEnvoi('import');
    const r = await envoyer<ListeOfficielle>('/api/v1/admin/listes', {
      code,
      titre,
      publieLe: publieLe || null,
      valableJusquAu: valableJusquAu || null,
      fichierNom: apercu?.fichierNom ?? fichier?.name ?? null,
      noteSource: note.trim() || null,
      lignes: lignes.map((l) => ({ rubrique: l.rubrique, marque: l.marque || null, produitLibelle: l.produitLibelle || null, mention: l.mention || null, touteMarque: l.touteMarque, rubriqueReservee: l.rubriqueReservee })),
    });
    setEnvoi('aucun');
    if (!r.ok) {
      surRefus(r.statut);
      setErreur(phraseErreur(r));
      return;
    }
    surImporte(r.data);
  };

  return (
    <div id="import-liste" className="flex min-w-0 max-w-full flex-col gap-3 rounded-sm border border-border bg-surface-2 p-4">
      <form className="flex min-w-0 flex-col gap-3" onSubmit={analyser}>
        <h2 className="text-17 font-semibold">Importer une édition</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-[6px]">
            <label htmlFor="import-code" className="font-semibold">
              Liste
            </label>
            <select id="import-code" className="champ" value={code} onChange={(e) => setCode(e.target.value as CodeListe)}>
              {CODES_LISTES.map((c) => (
                <option key={c} value={c}>
                  {LIBELLE_CODE[c]}
                </option>
              ))}
            </select>
          </div>
          <Champ id="import-titre" etiquette="Titre de l’édition" maxLength={200} value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Consistoire de Paris — Produits 2025-2026" />
          <Champ id="import-publie" etiquette="Publiée le" type="date" value={publieLe} onChange={(e) => setPublieLe(e.target.value)} aide="Un mois seul (« juillet 2025 ») : le 1er du mois." />
          <Champ id="import-fin" etiquette="Valable jusqu’au" type="date" value={valableJusquAu} onChange={(e) => setValableJusquAu(e.target.value)} aide="Vide : sans date de fin annoncée." />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ id="import-fichier" etiquette="Fichier (PDF, texte ou CSV, 10 Mo au plus)" type="file" accept=".pdf,.txt,.csv,text/plain,text/csv,application/pdf" className="py-[8px]" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} />
          <ZoneTexte
            id="import-texte"
            etiquette="… ou le texte collé"
            aide={`Le fichier l’emporte s’il est choisi. Le texte est analysé, jamais gardé tel quel. ${nombre(MAX_TEXTE_COLLE)} caractères au plus (≈ 1 Mo) : au-delà, importez par fichier.`}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            className="min-h-[96px]"
            maxLength={MAX_TEXTE_COLLE}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Bouton type="submit" variante="primaire" disabled={envoi !== 'aucun'}>
            {envoi === 'apercu' ? 'Analyse…' : apercu ? 'Refaire l’aperçu' : 'Aperçu'}
          </Bouton>
          <Bouton onClick={surAnnule}>Annuler</Bouton>
        </div>
      </form>

      {apercu ? (
        <section aria-labelledby="titre-apercu" className="flex min-w-0 flex-col gap-3">
          <h2 id="titre-apercu" className="text-17 font-semibold">
            Aperçu · {pluriel(lignes.length, 'ligne lue', 'lignes lues')}
            {apercu.fichierNom ? <span className="muet"> · {apercu.fichierNom}</span> : null}
          </h2>
          {apercu.avertissements.length ? (
            <Bandeau ton="warn">
              <p className="font-semibold">
                {apercu.avertissements.length} avertissement{apercu.avertissements.length > 1 ? 's' : ''} de l’analyse
              </p>
              <ul className="ml-5 list-disc">
                {apercu.avertissements.map((a, i) => (
                  <li key={i} className="break-words">
                    {a}
                  </li>
                ))}
              </ul>
            </Bandeau>
          ) : null}
          <ZoneTexte id="import-note" etiquette="Note de la source (introduction, réserves)" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[72px]" maxLength={4000} />
          <TableLignes lignes={lignes} surChange={setLignes} />
          {erreur ? (
            <Bandeau ton="warn" role="alert">
              {erreur}
            </Bandeau>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Bouton variante="primaire" disabled={envoi !== 'aucun'} onClick={() => void importer()}>
              {envoi === 'import' ? 'Import…' : `Importer ${pluriel(lignes.length, 'ligne', 'lignes')}`}
            </Bouton>
            <Bouton onClick={surAnnule}>Annuler</Bouton>
          </div>
        </section>
      ) : erreur ? (
        <Bandeau ton="warn" role="alert">
          {erreur}
        </Bandeau>
      ) : null}
    </div>
  );
}

/**
 * Les lignes de l'aperçu, éditables en place : un tableau qui défile dans SON conteneur (jamais la page), 200 lignes par
 * page, l'incohérence dite à côté de la ligne ; la case « Réservée » se recalcule quand le texte de la rubrique change
 * (et reste cochable en plus — le serveur recalcule aussi).
 */
function TableLignes({ lignes, surChange }: { lignes: LigneAnalysee[]; surChange: (l: LigneAnalysee[]) => void }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(lignes.length / LIGNES_PAR_PAGE));
  const p = Math.min(page, pages - 1);
  const debut = p * LIGNES_PAR_PAGE;
  const visibles = lignes.slice(debut, debut + LIGNES_PAR_PAGE);
  const modifier = (i: number, champ: Partial<LigneAnalysee>) => surChange(lignes.map((l, j) => (j === i ? { ...l, ...champ } : l)));
  const renommer = (i: number, rubrique: string) => modifier(i, { rubrique, rubriqueReservee: rubriqueReservee(rubrique) });
  const retirer = (i: number) => surChange(lignes.filter((_, j) => j !== i));
  const ajouter = () => {
    surChange([...lignes, { rubrique: '', marque: null, produitLibelle: null, mention: null, touteMarque: false, rubriqueReservee: false, ordre: lignes.length }]);
    setPage(Math.ceil((lignes.length + 1) / LIGNES_PAR_PAGE) - 1);
  };
  const incoherentes = numerosIncoherents(lignes);
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-2">
      {incoherentes.length ? (
        <p className="text-warn font-semibold" role="status">
          {pluriel(incoherentes.length, 'ligne incohérente', 'lignes incohérentes')} à corriger avant l’import (n° {incoherentes.slice(0, 10).join(', ')}
          {incoherentes.length > 10 ? '…' : ''}).
        </p>
      ) : null}
      {/* `relative` : le conteneur qui défile est aussi le bloc conteneur du texte masqué (`.cache-visuel`, positionné), sinon ce texte élargit la PAGE. */}
      <div className="relative w-full min-w-0 max-w-full overflow-x-auto" data-defile="lignes-apercu">
        <table className="w-full min-w-[760px] border-collapse text-note">
          <thead>
            <tr className="text-left">
              <th scope="col" className="px-1 py-1 font-semibold">
                N°
              </th>
              <th scope="col" className="px-1 py-1 font-semibold">
                Rubrique
              </th>
              <th scope="col" className="px-1 py-1 font-semibold">
                Marque
              </th>
              <th scope="col" className="px-1 py-1 font-semibold">
                Produit
              </th>
              <th scope="col" className="px-1 py-1 font-semibold">
                Mention
              </th>
              <th scope="col" className="px-1 py-1 text-center font-semibold">
                Toute marque
              </th>
              <th scope="col" className="px-1 py-1 text-center font-semibold">
                Réservée
              </th>
              <th scope="col" className="px-1 py-1">
                <span className="cache-visuel">Retirer</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((l, k) => {
              const i = debut + k;
              const souci = incoherenceLigne(l);
              return (
                <tr key={i} className="border-t border-border align-top">
                  <td className="px-1 py-1 pt-[14px] text-muted">{i + 1}</td>
                  <td className="px-1 py-1">
                    <input className="champ min-h-[40px] px-2 py-1" aria-label={`Rubrique, ligne ${i + 1}`} value={l.rubrique} onChange={(e) => renommer(i, e.target.value)} />
                    {souci ? <p className="text-warn mt-1 text-small">{souci}</p> : null}
                  </td>
                  <td className="px-1 py-1">
                    <input className="champ min-h-[40px] px-2 py-1" aria-label={`Marque, ligne ${i + 1}`} value={l.marque ?? ''} onChange={(e) => modifier(i, { marque: e.target.value || null })} />
                  </td>
                  <td className="px-1 py-1">
                    <input className="champ min-h-[40px] px-2 py-1" aria-label={`Produit, ligne ${i + 1}`} value={l.produitLibelle ?? ''} onChange={(e) => modifier(i, { produitLibelle: e.target.value || null })} />
                  </td>
                  <td className="px-1 py-1">
                    <input className="champ min-h-[40px] px-2 py-1" aria-label={`Mention, ligne ${i + 1}`} value={l.mention ?? ''} onChange={(e) => modifier(i, { mention: e.target.value || null })} />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <input type="checkbox" className="mt-3 h-5 w-5" aria-label={`Toute marque, ligne ${i + 1}`} checked={l.touteMarque} onChange={(e) => modifier(i, { touteMarque: e.target.checked })} />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <input type="checkbox" className="mt-3 h-5 w-5" aria-label={`Rubrique réservée, ligne ${i + 1}`} checked={l.rubriqueReservee} onChange={(e) => modifier(i, { rubriqueReservee: e.target.checked })} />
                  </td>
                  <td className="px-1 py-1">
                    <button type="button" className="lien min-h-[40px]" onClick={() => retirer(i)} aria-label={`Retirer la ligne ${i + 1}`}>
                      Retirer
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Bouton className="min-h-[40px]" onClick={ajouter}>
          Ajouter une ligne
        </Bouton>
        {pages > 1 ? (
          <>
            <span className="muet">
              Page {p + 1} / {pages}
            </span>
            <Bouton className="min-h-[40px]" disabled={p === 0} onClick={() => setPage(p - 1)}>
              Précédente
            </Bouton>
            <Bouton className="min-h-[40px]" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>
              Suivante
            </Bouton>
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- La page d'une liste ---------- */

export function ListeDetail({ surRefus }: { surRefus: Refus }) {
  const { id = '' } = useParams();
  const [q, setQ] = useState('');
  const [qEnvoye, setQEnvoye] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQEnvoye(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const url = useMemo(() => `/api/v1/admin/listes/${encodeURIComponent(id)}/lignes${qEnvoye ? `?q=${encodeURIComponent(qEnvoye)}` : ''}`, [id, qEnvoye]);
  const { etat, charger, setEtat } = useLecture<ReponseLignes>(url, surRefus);
  const [ajout, setAjout] = useState(false);
  // La dernière lecture réussie reste affichée (en-tête de la liste, champ de recherche MONTÉ, focus gardé) pendant qu'une
  // nouvelle recherche charge ; seule la zone des lignes dit « Lecture… » ou « Non lu ».
  const [connu, setConnu] = useState<ReponseLignes | null>(null);
  useEffect(() => {
    if (etat.phase === 'ok') setConnu(etat.data);
  }, [etat]);
  const donnees = etat.phase === 'ok' ? etat.data : connu;
  const liste = donnees?.liste ?? null;

  const champRecherche = (
    <input className="champ max-w-[320px]" type="search" placeholder="Rubrique, marque, produit…" aria-label="Chercher dans les lignes" value={q} onChange={(e) => setQ(e.target.value)} />
  );

  const poserListe = (l: ListeOfficielle) => {
    if (etat.phase === 'ok') setEtat({ phase: 'ok', data: { ...etat.data, liste: l } });
  };
  const poserLignes = (ls: LigneListe[]) => {
    if (etat.phase === 'ok') setEtat({ phase: 'ok', data: { ...etat.data, lignes: ls, compte: etat.data.compte + (ls.length - etat.data.lignes.length) } });
  };

  if (!liste) {
    return (
      <section className="carte flex flex-col gap-3" aria-labelledby="titre-lignes">
        <Link to="/admin/listes" className="lien">
          ← Toutes les listes
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="titre-lignes" className="text-17 font-semibold">
            Lignes
          </h2>
          {champRecherche}
        </div>
        <EtatNonLu etat={etat.phase === 'ok' ? { phase: 'chargement' } : etat} recharger={() => void charger()} />
      </section>
    );
  }
  const lignes = etat.phase === 'ok' ? etat.data.lignes : null;
  const compte = etat.phase === 'ok' ? etat.data.compte : null;
  const tronque = etat.phase === 'ok' && Boolean(etat.data.tronque) && lignes !== null && compte !== null && compte > lignes.length;

  return (
    <>
      <EnTeteListe liste={liste} surModifie={poserListe} surRefus={surRefus} />
      <section className="carte flex flex-col gap-3" aria-labelledby="titre-lignes">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="titre-lignes" className="text-17 font-semibold">
              Lignes{compte !== null ? ` · ${nombre(compte)}` : ''}
              {qEnvoye ? ` pour « ${qEnvoye} »` : ''}
            </h2>
            <p className="muet">Modifier ou retirer une ligne s’écrit au journal ; un retrait est doux (la ligne reste en base).</p>
          </div>
          {champRecherche}
        </div>
        {lignes === null || compte === null ? (
          <EtatNonLu etat={etat.phase === 'ok' ? { phase: 'chargement' } : etat} recharger={() => void charger()} />
        ) : (
          <>
            {tronque ? (
              <Bandeau ton="warn" role="status">
                {nombre(lignes.length)} lignes affichées sur {nombre(compte)} : précisez la recherche pour voir les autres.
              </Bandeau>
            ) : null}
            {lignes.length === 0 ? <p className="muet">{qEnvoye ? `Aucune ligne ne contient « ${qEnvoye} ».` : 'Cette liste n’a aucune ligne vivante.'}</p> : null}
            <ul className="liste" role="list">
              {lignes.map((l) => (
                <LigneVue key={l.id} liste={liste} ligne={l} surRefus={surRefus} surModifie={(m) => poserLignes(lignes.map((x) => (x.id === m.id ? m : x)))} surRetire={() => poserLignes(lignes.filter((x) => x.id !== l.id))} />
              ))}
            </ul>
          </>
        )}
        {lignes === null ? null : ajout ? (
          <FormulaireLigne
            cle={`ajout-${liste.id}`}
            titre="Ajouter une ligne"
            libelleBouton="Ajouter"
            surAnnule={() => setAjout(false)}
            surRefus={surRefus}
            envoyerLigne={(corps) => envoyer<LigneListe>(`/api/v1/admin/listes/${liste.id}/lignes`, corps)}
            surEnvoyee={(m) => {
              poserLignes([...lignes, m]);
              setAjout(false);
            }}
          />
        ) : (
          <Bouton className="self-start" onClick={() => setAjout(true)}>
            Ajouter une ligne
          </Bouton>
        )}
      </section>
    </>
  );
}

function EnTeteListe({ liste, surModifie, surRefus }: { liste: ListeOfficielle; surModifie: (l: ListeOfficielle) => void; surRefus: Refus }) {
  const [edition, setEdition] = useState(false);
  const [titre, setTitre] = useState(liste.titre);
  const [publieLe, setPublieLe] = useState(liste.publieLe ?? '');
  const [valableJusquAu, setValableJusquAu] = useState(liste.valableJusquAu ?? '');
  const [note, setNote] = useState(liste.noteSource ?? '');
  const [confirmer, setConfirmer] = useState<'activer' | 'desactiver' | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const modifier = async (corps: Record<string, unknown>) => {
    setEnvoi(true);
    setErreur(null);
    const r = await envoyer<ListeOfficielle>(`/api/v1/admin/listes/${liste.id}`, corps, 'PUT');
    setEnvoi(false);
    if (!r.ok) {
      surRefus(r.statut);
      setErreur(phraseErreur(r));
      return false;
    }
    surModifie(r.data);
    return true;
  };

  return (
    <section className="carte flex flex-col gap-3" aria-labelledby="titre-liste">
      <Link to="/admin/listes" className="lien self-start">
        ← Toutes les listes
      </Link>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 id="titre-liste" className="min-w-0 flex-1 text-18 font-bold">
          {liste.titre}
        </h1>
        <PastillesListe liste={liste} />
      </div>
      <p className="muet">
        {LIBELLE_CODE[liste.code]} · {datesListe(liste)} · {pluriel(liste.nombreLignes, 'ligne', 'lignes')} · importée le {formaterJour(liste.importeLe)}
        {liste.fichierNom ? ` · ${liste.fichierNom}` : ''}
      </p>
      {liste.noteSource && !edition ? <p className="whitespace-pre-line text-note">{liste.noteSource}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Bouton className="min-h-[40px]" aria-expanded={edition} onClick={() => setEdition(!edition)}>
          {edition ? 'Fermer la modification' : 'Modifier la liste'}
        </Bouton>
        {confirmer ? null : (
          <Bouton className="min-h-[40px]" onClick={() => setConfirmer(liste.active ? 'desactiver' : 'activer')}>
            {liste.active ? 'Désactiver' : 'Activer'}
          </Bouton>
        )}
      </div>
      {confirmer ? (
        <Bandeau ton="warn" role="alert" className="flex flex-wrap items-center gap-3">
          <span className="min-w-0 flex-1">
            {confirmer === 'activer' ? `Activer cette édition désactive l’autre édition active de « ${LIBELLE_CODE[liste.code]} », s’il y en a une. Les cartes la liront aussitôt.` : 'Désactiver cette édition : les cartes ne la liront plus (si aucune autre édition n’est active, le niveau 2 dira « Non vérifié »).'}
          </span>
          <Bouton
            variante="primaire"
            className="min-h-[40px]"
            disabled={envoi}
            onClick={async () => {
              if (await modifier({ active: confirmer === 'activer' })) setConfirmer(null);
            }}
          >
            {envoi ? 'Envoi…' : confirmer === 'activer' ? 'Confirmer l’activation' : 'Confirmer la désactivation'}
          </Bouton>
          <Bouton className="min-h-[40px]" onClick={() => setConfirmer(null)}>
            Annuler
          </Bouton>
        </Bandeau>
      ) : null}
      {edition ? (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await modifier({ titre, publieLe: publieLe || null, valableJusquAu: valableJusquAu || null, noteSource: note.trim() || null })) setEdition(false);
          }}
        >
          <Champ id="liste-titre" etiquette="Titre" required maxLength={200} value={titre} onChange={(e) => setTitre(e.target.value)} className="sm:col-span-2" />
          <Champ id="liste-publie" etiquette="Publiée le" type="date" value={publieLe} onChange={(e) => setPublieLe(e.target.value)} />
          <Champ id="liste-fin" etiquette="Valable jusqu’au" type="date" value={valableJusquAu} onChange={(e) => setValableJusquAu(e.target.value)} aide="Vide : sans date de fin annoncée." />
          <div className="sm:col-span-2">
            <ZoneTexte id="liste-note" etiquette="Note de la source" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[72px]" maxLength={4000} />
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Bouton type="submit" variante="primaire" disabled={envoi}>
              {envoi ? 'Enregistrement…' : 'Enregistrer'}
            </Bouton>
            <Bouton onClick={() => setEdition(false)}>Annuler</Bouton>
          </div>
        </form>
      ) : null}
      {erreur ? (
        <Bandeau ton="warn" role="alert">
          {erreur}
        </Bandeau>
      ) : null}
    </section>
  );
}

function LigneVue({ liste, ligne: l, surModifie, surRetire, surRefus }: { liste: ListeOfficielle; ligne: LigneListe; surModifie: (m: LigneListe) => void; surRetire: () => void; surRefus: Refus }) {
  const [edition, setEdition] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const mention = libelleMention(l.mention);

  const retirer = async () => {
    setEnvoi(true);
    setErreur(null);
    const r = await appel<{ ok: true }>(`/api/v1/admin/listes/${liste.id}/lignes/${l.id}`, { method: 'DELETE' });
    setEnvoi(false);
    if (!r.ok) {
      surRefus(r.statut);
      setErreur(phraseErreur(r));
      return;
    }
    surRetire();
  };

  return (
    <li className="py-[10px]">
      <p className="break-words">
        <span className="font-semibold">{l.rubrique}</span>
        {l.marque ? ` · ${l.marque}` : ''}
        {l.produitLibelle ? ` · ${l.produitLibelle}` : ''}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex-1" />
        {l.touteMarque ? <Pastille ton="neutre">Toute marque</Pastille> : null}
        {l.rubriqueReservee ? <Pastille ton="warn">Rubrique réservée</Pastille> : null}
        {mention ? <Pastille ton="neutre">{`Mention · ${mention}`}</Pastille> : null}
        {edition || confirmer ? null : (
          <span className="flex gap-3">
            <button type="button" className="lien" aria-expanded={edition} onClick={() => setEdition(true)}>
              Modifier
            </button>
            <button type="button" className="lien" onClick={() => setConfirmer(true)}>
              Retirer
            </button>
          </span>
        )}
      </div>
      {confirmer ? (
        <Bandeau ton="warn" role="alert" className="mt-2 flex flex-wrap items-center gap-3">
          <span className="min-w-0 flex-1">Retirer cette ligne ? Les cartes ne la liront plus ; elle reste en base (retrait doux) et le journal le note.</span>
          <Bouton variante="primaire" className="min-h-[40px]" disabled={envoi} onClick={() => void retirer()}>
            {envoi ? 'Retrait…' : 'Confirmer le retrait'}
          </Bouton>
          <Bouton className="min-h-[40px]" onClick={() => setConfirmer(false)}>
            Annuler
          </Bouton>
        </Bandeau>
      ) : null}
      {edition ? (
        <FormulaireLigne
          cle={l.id}
          initial={l}
          titre="Modifier la ligne"
          libelleBouton="Enregistrer"
          surAnnule={() => setEdition(false)}
          surRefus={surRefus}
          envoyerLigne={(corps) => envoyer<LigneListe>(`/api/v1/admin/listes/${liste.id}/lignes/${l.id}`, corps, 'PUT')}
          surEnvoyee={(m) => {
            surModifie(m);
            setEdition(false);
          }}
        />
      ) : null}
      {erreur ? (
        <Bandeau ton="warn" role="alert" className="mt-2">
          {erreur}
        </Bandeau>
      ) : null}
    </li>
  );
}

type CorpsLigne = { rubrique: string; marque: string | null; produitLibelle: string | null; mention: string | null; touteMarque: boolean; rubriqueReservee: boolean };

/** Le formulaire d'une ligne (ajout ou modification en place) : l'incohérence est dite avant l'envoi, le serveur reste juge. */
function FormulaireLigne({ cle, initial, titre, libelleBouton, surAnnule, surRefus, envoyerLigne, surEnvoyee }: { cle: string; initial?: LigneListe; titre: string; libelleBouton: string; surAnnule: () => void; surRefus: Refus; envoyerLigne: (corps: CorpsLigne) => ReturnType<typeof envoyer<LigneListe>>; surEnvoyee: (l: LigneListe) => void }) {
  const [rubrique, setRubrique] = useState(initial?.rubrique ?? '');
  const [marque, setMarque] = useState(initial?.marque ?? '');
  const [produit, setProduit] = useState(initial?.produitLibelle ?? '');
  const [mention, setMention] = useState(libelleMention(initial?.mention) ?? '');
  const [touteMarque, setTouteMarque] = useState(initial?.touteMarque ?? false);
  const [reservee, setReservee] = useState(initial?.rubriqueReservee ?? false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const corps: CorpsLigne = { rubrique, marque: marque.trim() || null, produitLibelle: produit.trim() || null, mention: mention.trim() || null, touteMarque, rubriqueReservee: reservee || rubriqueReservee(rubrique) };
  const souci = incoherenceLigne(corps);

  const envoyerFormulaire = async (e: FormEvent) => {
    e.preventDefault();
    if (souci) {
      setErreur(souci);
      return;
    }
    setEnvoi(true);
    setErreur(null);
    const r = await envoyerLigne(corps);
    setEnvoi(false);
    if (!r.ok) {
      surRefus(r.statut);
      setErreur(phraseErreur(r));
      return;
    }
    surEnvoyee(r.data);
  };

  return (
    <form className="mt-2 grid gap-3 rounded-sm border border-border bg-surface-2 p-3 sm:grid-cols-2" onSubmit={envoyerFormulaire} aria-label={titre}>
      <p className="font-semibold sm:col-span-2">{titre}</p>
      <Champ
        id={`rubrique-${cle}`}
        etiquette="Rubrique"
        required
        maxLength={200}
        value={rubrique}
        onChange={(e) => {
          // La case « Réservée » suit le texte de la rubrique (« VINS » la coche) ; elle reste cochable en plus.
          setRubrique(e.target.value);
          setReservee(rubriqueReservee(e.target.value));
        }}
      />
      <Champ id={`marque-${cle}`} etiquette="Marque" maxLength={200} value={marque} onChange={(e) => setMarque(e.target.value)} />
      <Champ id={`produit-${cle}`} etiquette="Produit (libellé)" maxLength={300} value={produit} onChange={(e) => setProduit(e.target.value)} />
      <Champ id={`mention-${cle}`} etiquette="Mention" maxLength={300} value={mention} onChange={(e) => setMention(e.target.value)} aide="« L », « (L) » ou « lait non surveillé » → lait non surveillé ; sinon un texte libre." />
      <label className="flex min-h-tap items-center gap-2">
        <input type="checkbox" className="h-5 w-5" checked={touteMarque} onChange={(e) => setTouteMarque(e.target.checked)} />
        Toute marque autorisée (rubrique sans marque nommée)
      </label>
      <label className="flex min-h-tap items-center gap-2">
        <input type="checkbox" className="h-5 w-5" checked={reservee} onChange={(e) => setReservee(e.target.checked)} />
        Rubrique réservée (jamais « toute marque »)
      </label>
      {souci && !erreur ? <p className="text-warn text-small sm:col-span-2">{souci}</p> : null}
      {erreur ? (
        <Bandeau ton="warn" role="alert" className="sm:col-span-2">
          {erreur}
        </Bandeau>
      ) : null}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Bouton type="submit" variante="primaire" disabled={envoi}>
          {envoi ? 'Envoi…' : libelleBouton}
        </Bouton>
        <Bouton onClick={surAnnule}>Annuler</Bouton>
      </div>
    </form>
  );
}
