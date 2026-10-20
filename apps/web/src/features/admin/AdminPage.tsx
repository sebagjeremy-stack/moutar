import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Additif, Produit, StatutAdditif, Ton } from '@moutar/shared-types';
import { Bandeau } from '../../components/Bandeau';
import { Bouton } from '../../components/Bouton';
import { Champ } from '../../components/Champ';
import { Pastille } from '../../components/Pastille';
import { appel, envoyer, lire } from '../../lib/api';
import { formaterJour } from '../../lib/dates';

interface Session {
  email: string;
  nom: string;
}
interface AdditifConsole extends Additif {
  surcharge: { statut: StatutAdditif; source: string; note: string | null; updatedAt: string } | null;
  statutEffectif: StatutAdditif;
}
interface LigneJournal {
  id: string;
  action: string;
  objet: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
  email: string | null;
}

type Onglet = 'additifs' | 'produits' | 'journal';

const LIBELLE_STATUT: Record<StatutAdditif, string> = { casher: 'Casher', douteux: 'Douteux', non_casher: 'Non casher', inconnu: 'Inconnu' };
const TON_STATUT: Record<StatutAdditif, Ton> = { casher: 'ok', douteux: 'warn', non_casher: 'danger', inconnu: 'neutre' };

/** /admin — connexion (e-mail + mot de passe), puis un tableau de bord sobre : Additifs, Produits, Journal. */
export function AdminPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  const relire = useCallback(async () => {
    const r = await lire<Session>('/api/v1/admin/moi');
    setSession(r.ok ? r.data : null);
  }, []);

  useEffect(() => {
    void relire();
  }, [relire]);
  const deconnecter = useCallback(() => setSession(null), []);

  if (session === undefined) {
    return (
      <Coquille>
        <p className="muet" role="status">
          Vérification de la session…
        </p>
      </Coquille>
    );
  }
  if (session === null) return <Connexion surConnecte={relire} />;
  return <TableauDeBord session={session} surDeconnecte={deconnecter} />;
}

function Coquille({ children, droite }: { children: React.ReactNode; droite?: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-console flex-col bg-bg">
      {/* La console : plus sobre, mêmes jetons — en-tête lavande (soft), cartes rondes. */}
      <header className="barre border-primary-soft bg-primary-soft">
        <Link to="/" className="marque">
          <span className="marque-nom">Moutar</span>
        </Link>
        <span className="muet">· console</span>
        <span className="flex-1" />
        {droite}
      </header>
      <main className="flex flex-1 flex-col gap-3 p-gutter">{children}</main>
    </div>
  );
}

function Connexion({ surConnecte }: { surConnecte: () => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const connecter = async (e: FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    const r = await envoyer<Session>('/api/v1/admin/connexion', { email, motDePasse });
    setEnvoi(false);
    if (!r.ok) {
      setErreur(r.message);
      return;
    }
    await surConnecte();
  };

  return (
    <Coquille>
      <form className="carte mx-auto mt-6 flex w-full max-w-[420px] flex-col gap-3" onSubmit={connecter}>
        <h1 className="text-title font-bold">Connexion</h1>
        <Champ id="email" etiquette="Adresse e-mail" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Champ id="mdp" etiquette="Mot de passe" type="password" autoComplete="current-password" required value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
        {erreur ? (
          <Bandeau ton="warn" role="alert">
            {erreur}
          </Bandeau>
        ) : null}
        <Bouton type="submit" variante="primaire" bloc disabled={envoi}>
          {envoi ? 'Connexion…' : 'Se connecter'}
        </Bouton>
      </form>
    </Coquille>
  );
}

function TableauDeBord({ session, surDeconnecte }: { session: Session; surDeconnecte: () => void }) {
  const [onglet, setOnglet] = useState<Onglet>('additifs');
  const onglets: Array<[Onglet, string]> = [
    ['additifs', 'Additifs'],
    ['produits', 'Produits'],
    ['journal', 'Journal'],
  ];
  const surRefus = useCallback(
    (statut: number) => {
      if (statut === 401 || statut === 403) surDeconnecte();
    },
    [surDeconnecte],
  );
  return (
    <Coquille
      droite={
        <>
          <span className="muet hidden sm:inline">{session.email}</span>
          <Bouton
            className="min-h-[40px]"
            onClick={async () => {
              await appel('/api/v1/admin/deconnexion', { method: 'POST' });
              surDeconnecte();
            }}
          >
            Se déconnecter
          </Bouton>
        </>
      }
    >
      <nav aria-label="Sections" className="flex gap-2">
        {onglets.map(([cle, libelle]) => (
          <button key={cle} type="button" className={`btn min-h-[40px] ${onglet === cle ? 'border-primary bg-primary-soft text-primary-strong' : ''}`} aria-current={onglet === cle ? 'page' : undefined} onClick={() => setOnglet(cle)}>
            {libelle}
          </button>
        ))}
      </nav>
      {onglet === 'additifs' ? <Additifs surRefus={surRefus} /> : onglet === 'produits' ? <Produits surRefus={surRefus} /> : <Journal surRefus={surRefus} />}
    </Coquille>
  );
}

type Chargement<T> = { phase: 'chargement' } | { phase: 'ok'; data: T } | { phase: 'echec'; message: string };

function useLecture<T>(url: string, surRefus: (statut: number) => void) {
  const [etat, setEtat] = useState<Chargement<T>>({ phase: 'chargement' });
  const charger = useCallback(async () => {
    setEtat({ phase: 'chargement' });
    const r = await lire<T>(url);
    if (r.ok) setEtat({ phase: 'ok', data: r.data });
    else {
      surRefus(r.statut);
      setEtat({ phase: 'echec', message: r.message });
    }
  }, [url, surRefus]);
  useEffect(() => {
    void charger();
  }, [charger]);
  return { etat, charger, setEtat };
}

function EtatNonLu({ etat, recharger }: { etat: { phase: 'chargement' } | { phase: 'echec'; message: string }; recharger: () => void }) {
  if (etat.phase === 'chargement')
    return (
      <p className="muet" role="status">
        Lecture…
      </p>
    );
  return (
    <Bandeau ton="warn" role="alert" className="flex flex-wrap items-center gap-3">
      <Pastille ton="warn">Non lu</Pastille>
      <span className="flex-1">{etat.message}</span>
      <Bouton className="min-h-[40px]" onClick={recharger}>
        Réessayer
      </Bouton>
    </Bandeau>
  );
}

function Additifs({ surRefus }: { surRefus: (s: number) => void }) {
  const { etat, charger, setEtat } = useLecture<AdditifConsole[]>('/api/v1/admin/additifs', surRefus);
  const [filtre, setFiltre] = useState('');
  if (etat.phase !== 'ok') return <EtatNonLu etat={etat} recharger={() => void charger()} />;
  const f = filtre.trim().toLowerCase();
  const lignes = etat.data.filter((a) => !f || a.code.toLowerCase().includes(f) || a.nom.toLowerCase().includes(f));
  const remplacer = (ligne: AdditifConsole) => setEtat({ phase: 'ok', data: etat.data.map((a) => (a.code === ligne.code ? ligne : a)) });
  return (
    <section className="carte flex flex-col gap-3" aria-labelledby="titre-additifs">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="titre-additifs" className="text-17 font-semibold">
            Additifs · {etat.data.length} lignes
          </h1>
          <p className="muet">Le catalogue en code, et sa surcharge (statut, source, note). Chaque enregistrement s’écrit au journal.</p>
        </div>
        <input className="champ max-w-[260px]" type="search" placeholder="Filtrer (code, nom)" aria-label="Filtrer les additifs" value={filtre} onChange={(e) => setFiltre(e.target.value)} />
      </div>
      <ul className="liste" role="list">
        {lignes.map((a) => (
          <LigneAdditif key={a.code} additif={a} surEnregistre={remplacer} surRefus={surRefus} />
        ))}
      </ul>
    </section>
  );
}

function LigneAdditif({ additif: a, surEnregistre, surRefus }: { additif: AdditifConsole; surEnregistre: (l: AdditifConsole) => void; surRefus: (s: number) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [statut, setStatut] = useState<StatutAdditif>(a.surcharge?.statut ?? a.statut);
  const [source, setSource] = useState(a.surcharge?.source ?? '');
  const [note, setNote] = useState(a.surcharge?.note ?? '');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const enregistrer = async (e: FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    const r = await envoyer<AdditifConsole>(`/api/v1/admin/additifs/${a.code}`, { statut, source, note }, 'PUT');
    setEnvoi(false);
    if (!r.ok) {
      surRefus(r.statut);
      setErreur(r.message);
      return;
    }
    surEnregistre(r.data);
    setOuvert(false);
  };

  return (
    <li className="py-[10px]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="w-[72px] font-semibold">{a.code}</span>
        <span className="min-w-0 flex-1">
          {a.nom} <span className="muet">· {a.famille}</span>
        </span>
        <Pastille ton={TON_STATUT[a.statutEffectif]}>{LIBELLE_STATUT[a.statutEffectif] + (a.surcharge ? ' · confirmé' : ' · catalogue')}</Pastille>
        <button type="button" className="lien" aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)}>
          {ouvert ? 'Fermer' : 'Modifier'}
        </button>
      </div>
      <p className="muet mt-1">
        {a.note} Source : {a.surcharge?.source ?? a.source}
        {a.surcharge ? ` (confirmé le ${formaterJour(a.surcharge.updatedAt)})` : ''}
      </p>
      {ouvert ? (
        <form className="mt-2 grid gap-3 sm:grid-cols-[160px_1fr_1fr_auto] sm:items-end" onSubmit={enregistrer}>
          <div className="flex flex-col gap-[6px]">
            <label htmlFor={`statut-${a.code}`} className="font-semibold">
              Statut
            </label>
            <select id={`statut-${a.code}`} className="champ" value={statut} onChange={(e) => setStatut(e.target.value as StatutAdditif)}>
              {(Object.keys(LIBELLE_STATUT) as StatutAdditif[]).map((s) => (
                <option key={s} value={s}>
                  {LIBELLE_STATUT[s]}
                </option>
              ))}
            </select>
          </div>
          <Champ id={`source-${a.code}`} etiquette="Source (obligatoire)" required maxLength={500} value={source} onChange={(e) => setSource(e.target.value)} placeholder="liste de référence, page, date…" />
          <Champ id={`note-${a.code}`} etiquette="Note" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          <Bouton type="submit" variante="primaire" disabled={envoi}>
            {envoi ? 'Enregistrement…' : 'Enregistrer'}
          </Bouton>
          {erreur ? (
            <Bandeau ton="warn" role="alert" className="sm:col-span-4">
              {erreur}
            </Bandeau>
          ) : null}
        </form>
      ) : null}
    </li>
  );
}

function Produits({ surRefus }: { surRefus: (s: number) => void }) {
  const { etat, charger } = useLecture<{ compte: number; produits: Produit[] }>('/api/v1/admin/produits', surRefus);
  if (etat.phase !== 'ok') return <EtatNonLu etat={etat} recharger={() => void charger()} />;
  return (
    <section className="carte" aria-labelledby="titre-produits">
      <h1 id="titre-produits" className="text-17 font-semibold">
        Produits · {etat.data.compte} derniers lus
      </h1>
      {etat.data.produits.length === 0 ? (
        <p className="muet mt-2">Aucun produit lu pour l’instant.</p>
      ) : (
        <ul className="liste mt-2" role="list">
          {etat.data.produits.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="min-w-0 flex-1">
                {p.ean ? (
                  <Link to={`/produit/${p.ean}`} className="font-semibold text-text">
                    {p.nom}
                  </Link>
                ) : (
                  <span className="font-semibold">{p.nom}</span>
                )}
                {p.marque ? <span className="muet"> · {p.marque}</span> : null}
              </span>
              <span className="muet">
                {p.ean ?? 'sans EAN'} · {p.source === 'off' ? 'Open Food Facts' : p.source === 'manuel' ? 'manuel' : 'OCR'} · lu le {formaterJour(p.luLe)} · {p.additifs.length} additif{p.additifs.length > 1 ? 's' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Journal({ surRefus }: { surRefus: (s: number) => void }) {
  const { etat, charger } = useLecture<LigneJournal[]>('/api/v1/admin/journal', surRefus);
  if (etat.phase !== 'ok') return <EtatNonLu etat={etat} recharger={() => void charger()} />;
  const quand = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  return (
    <section className="carte" aria-labelledby="titre-journal">
      <h1 id="titre-journal" className="text-17 font-semibold">
        Journal · {etat.data.length} dernières lignes
      </h1>
      <p className="muet">En ajout seul : rien ne s’y modifie ni ne s’y efface.</p>
      {etat.data.length === 0 ? (
        <p className="muet mt-2">Aucune ligne.</p>
      ) : (
        <ul className="liste mt-2" role="list">
          {etat.data.map((l) => (
            <li key={l.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="muet w-[130px]">{quand.format(new Date(l.createdAt))}</span>
              <span className="font-semibold">{l.action}</span>
              {l.objet ? <span>{l.objet}</span> : null}
              <span className="muet min-w-0 flex-1 break-words">{Object.keys(l.detail).length ? JSON.stringify(l.detail) : ''}</span>
              <span className="muet">{l.email ?? '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
