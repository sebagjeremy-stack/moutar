import { useState, type FormEvent } from 'react';
import type { Certificateur } from '@moutar/shared-types';
import { libelleMentionCertification } from '@moutar/shared-types/catalogues/certificateurs';
import { Bandeau } from '../../components/Bandeau';
import { Bouton } from '../../components/Bouton';
import { Champ } from '../../components/Champ';
import { Pastille } from '../../components/Pastille';
import { envoyer } from '../../lib/api';
import { phraseErreur } from '../../lib/erreurs';
import { EtatNonLu, useLecture } from './lecture';
import type { Refus } from './outils';

/*
 * L'onglet « Certificateurs » de la console (lot 3, écran au lot 5) : le catalogue EN CODE fusionné à sa surcharge
 * (`GET /admin/certificateurs`) ; un interrupteur « Actif » et une note → `PUT /admin/certificateurs/:code`, journalisé
 * côté serveur (`certificateur.surcharge`). Un certificateur désactivé n'est plus proposé à la lecture d'un logo et une
 * certification déjà validée avec lui redevient « Non vérifié » (ambre) sur la carte : la pastille le dit.
 */

/** La ligne telle que la console la rend (le type vit côté serveur, `admin.service.ts : CertificateurConsole`). */
interface CertificateurConsole extends Certificateur {
  actif: boolean;
  note: string | null;
  surcharge: { actif: boolean; note: string | null } | null;
}

export function Certificateurs({ surRefus }: { surRefus: Refus }) {
  const { etat, charger, setEtat } = useLecture<CertificateurConsole[]>('/api/v1/admin/certificateurs', surRefus);
  if (etat.phase !== 'ok') return <EtatNonLu etat={etat} recharger={() => void charger()} />;
  const remplacer = (ligne: CertificateurConsole) => setEtat({ phase: 'ok', data: etat.data.map((c) => (c.code === ligne.code ? ligne : c)) });
  const inactifs = etat.data.filter((c) => !c.actif).length;
  return (
    <section className="carte flex flex-col gap-3" aria-labelledby="titre-certificateurs">
      <div>
        <h1 id="titre-certificateurs" className="text-17 font-semibold">
          Certificateurs · {etat.data.length} au catalogue{inactifs ? ` · ${inactifs} désactivé${inactifs > 1 ? 's' : ''}` : ''}
        </h1>
        <p className="muet">Le catalogue en code (logos reconnus sur une photo), et sa surcharge : un organisme désactivé n’est plus proposé, et une certification déjà validée avec lui redevient « Non vérifié » sur la fiche. Chaque enregistrement s’écrit au journal.</p>
      </div>
      <ul className="liste" role="list">
        {etat.data.map((c) => (
          <LigneCertificateur key={c.code} c={c} surEnregistre={remplacer} surRefus={surRefus} />
        ))}
      </ul>
    </section>
  );
}

function LigneCertificateur({ c, surEnregistre, surRefus }: { c: CertificateurConsole; surEnregistre: (l: CertificateurConsole) => void; surRefus: Refus }) {
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(c.actif);
  const [note, setNote] = useState(c.note ?? '');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const enregistrer = async (e: FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const r = await envoyer<CertificateurConsole>(`/api/v1/admin/certificateurs/${c.code}`, { actif, note: note.trim() || null }, 'PUT');
    setEnvoi(false);
    if (!r.ok) {
      surRefus(r.statut);
      setErreur(phraseErreur(r));
      return;
    }
    surEnregistre(r.data);
    setOuvert(false);
  };

  return (
    <li className="py-[10px]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="w-[150px] font-semibold">{c.nomCourt}</span>
        <span className="min-w-0 flex-1">
          {c.nom} <span className="muet">· {c.pays}</span>
        </span>
        <Pastille ton={c.actif ? 'ok' : 'warn'}>{c.actif ? 'Actif' : 'Désactivé · fiches en « Non vérifié »'}</Pastille>
        <button type="button" className="lien" aria-expanded={ouvert} aria-controls={`certificateur-${c.code}`} onClick={() => setOuvert(!ouvert)}>
          {ouvert ? 'Fermer' : 'Modifier'}
        </button>
      </div>
      <p className="muet mt-1">
        Logo : {c.formeDuLogo} · mentions possibles : {c.mentionsPossibles.length ? c.mentionsPossibles.map(libelleMentionCertification).join(', ') : 'aucune'}
        {c.note ? ` · note : ${c.note}` : ''}
        {c.surcharge ? ' · surcharge de console' : ' · catalogue'}
      </p>
      {ouvert ? (
        <form id={`certificateur-${c.code}`} className="mt-2 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end" onSubmit={enregistrer}>
          <label className="flex min-h-tap cursor-pointer items-center gap-3 font-semibold">
            <input type="checkbox" role="switch" className="h-5 w-5 accent-primary" checked={actif} aria-checked={actif} onChange={(e) => setActif(e.target.checked)} />
            Actif
          </label>
          <Champ id={`note-certificateur-${c.code}`} etiquette="Note (facultatif)" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="pourquoi, depuis quand, source…" />
          <Bouton type="submit" variante="primaire" disabled={envoi}>
            {envoi ? 'Enregistrement…' : 'Enregistrer'}
          </Bouton>
          {!actif ? <p className="muet sm:col-span-3">Désactivé : plus proposé à la lecture d’un logo ; les fiches déjà certifiées par cet organisme diront « Non vérifié » (ambre) tant qu’il l’est.</p> : null}
          {erreur ? (
            <Bandeau ton="warn" role="alert" className="sm:col-span-3">
              {erreur}
            </Bandeau>
          ) : null}
        </form>
      ) : null}
    </li>
  );
}
