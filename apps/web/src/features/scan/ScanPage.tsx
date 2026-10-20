import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ResultatLectureLogo, TranscriptionOcr } from '@moutar/shared-types';
import { Bandeau } from '../../components/Bandeau';
import { Bouton } from '../../components/Bouton';
import { Champ } from '../../components/Champ';
import { BoutonRetour, Ecran, Marque } from '../../components/Ecran';
import { Emoji } from '../../components/Emoji';
import { appel } from '../../lib/api';
import { formaterEan } from '../../lib/dates';
import { phraseErreur } from '../../lib/erreurs';
import { PropositionsCertificateur } from '../certification/PropositionsCertificateur';
import { lireCodeBarres, normaliserCodeLu, type ArretLecture } from './lecteur-code-barres';
import { ImageIllisible, recompresser } from './recompression';

type Camera = { phase: 'demande' } | { phase: 'lecture' } | { phase: 'refus'; message: string };
type Mode = 'viseur' | 'manuel' | 'photo';
type Pour = 'logo' | 'ingredients' | null;
type Quoi = 'logo' | 'ingredients' | 'les_deux';

/** La photo prise, en mémoire seulement (jamais stockée) : libérée dès qu'on la remplace ou qu'on quitte l'écran. */
interface Image {
  blob: Blob;
  url: string;
  largeur: number;
  hauteur: number;
  recompressee: boolean;
}

type Lecture =
  | { phase: 'repos' }
  | { phase: 'preparation' }
  | { phase: 'envoi'; etape: 'logo' | 'ingredients' }
  /** Sans produit identifié : les propositions se lisent ici. */
  | { phase: 'resultat'; resultat: ResultatLectureLogo }
  | { phase: 'echec'; message: string; quoi: Quoi | null };

const TITRES: Record<'logo' | 'ingredients' | 'produit', string> = { logo: 'Photographier le logo', ingredients: 'Photographier l’étiquette', produit: 'Photographier le produit' };

/** « 1 600 × 1 200 px · 0,8 Mo ». */
function decrire(image: Image): string {
  const mo = image.blob.size / 1_000_000;
  const taille = mo >= 0.1 ? `${mo.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo` : `${Math.round(image.blob.size / 1000)} Ko`;
  return `${image.largeur.toLocaleString('fr-FR')} × ${image.hauteur.toLocaleString('fr-FR')} px · ${taille}${image.recompressee ? ' · réduite pour l’envoi' : ''}`;
}

/**
 * /scan — l'écran photo unifié (lot 3) : la caméra arrière lit le code-barres EN DIRECT (→ /produit/:ean) ; un bouton
 * prend une image de la même vue (ou une image de l'appareil, en secours), recompressée ici (≤ 1 600 px, ≤ 4 Mo, JPEG),
 * puis « Lire le logo » / « Lire les ingrédients » / « Lire les deux ». Sans produit identifié, le logo se lit à
 * `POST /logos/lire` et le résultat s'affiche ici ; venu de la fiche (`?pour=logo|ingredients&ean=`), l'image part sur la
 * route du produit et la suite se passe sur `/produit/:ean/logo` ou `/produit/:ean/ingredients` (résultat dans
 * `location.state`, jamais dans l'adresse). Quand le produit est déjà connu, le code-barres n'est plus lu (il est sur le
 * même emballage : on ne quitterait pas l'écran pour rien).
 */
export function ScanPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const pour: Pour = params.get('pour') === 'logo' ? 'logo' : params.get('pour') === 'ingredients' ? 'ingredients' : null;
  const ean = normaliserCodeLu(params.get('ean') ?? '');
  const video = useRef<HTMLVideoElement>(null);
  const fichier = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState<Camera>({ phase: 'demande' });
  const [mode, setMode] = useState<Mode>('viseur');
  const [image, setImage] = useState<Image | null>(null);
  const [lecture, setLecture] = useState<Lecture>({ phase: 'repos' });
  const [saisie, setSaisie] = useState('');
  const [erreurSaisie, setErreurSaisie] = useState<string | null>(null);

  // La caméra : demandée à chaque retour au viseur, coupée dès qu'on le quitte (photo prise, saisie manuelle, départ).
  useEffect(() => {
    if (mode !== 'viseur') return;
    let flux: MediaStream | null = null;
    let arret: ArretLecture | null = null;
    let annule = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera({ phase: 'refus', message: 'Ce navigateur ne donne pas accès à la caméra. Choisissez une image de l’appareil, ou saisissez le code à la main.' });
        return;
      }
      try {
        flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
      } catch (e) {
        const nom = e instanceof DOMException ? e.name : '';
        setCamera({
          phase: 'refus',
          message:
            nom === 'NotAllowedError'
              ? 'L’accès à la caméra a été refusé. Autorisez-le dans les réglages du navigateur, choisissez une image de l’appareil, ou saisissez le code à la main.'
              : nom === 'NotFoundError'
                ? 'Aucune caméra trouvée sur cet appareil. Choisissez une image, ou saisissez le code à la main.'
                : 'La caméra n’a pas pu démarrer. Réessayez, choisissez une image, ou saisissez le code à la main.',
        });
        return;
      }
      if (annule || !video.current) {
        flux.getTracks().forEach((t) => t.stop());
        return;
      }
      video.current.srcObject = flux;
      await video.current.play().catch(() => undefined);
      if (annule) return;
      setCamera({ phase: 'lecture' });
      // Produit déjà identifié : pas de lecture du code-barres (il est sur le même emballage).
      if (!ean) arret = await lireCodeBarres(video.current, (lu) => navigate(`/produit/${lu}`, { replace: true }));
    })();
    return () => {
      annule = true;
      arret?.();
      flux?.getTracks().forEach((t) => t.stop());
    };
  }, [mode, ean, navigate]);

  // L'adresse de l'aperçu est libérée dès que l'image change ou que l'écran se démonte : rien ne reste.
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );

  const reprendre = useCallback(() => {
    setImage(null);
    setLecture({ phase: 'repos' });
    setCamera({ phase: 'demande' });
    setMode('viseur');
  }, []);

  /** Une image prise ou choisie : recompressée ici, puis proposée à la lecture. */
  const preparer = useCallback(async (source: Blob) => {
    setMode('photo');
    setImage(null);
    setLecture({ phase: 'preparation' });
    try {
      const r = await recompresser(source);
      setImage({ blob: r.blob, url: URL.createObjectURL(r.blob), largeur: r.largeur, hauteur: r.hauteur, recompressee: r.recompressee });
      setLecture({ phase: 'repos' });
    } catch (e) {
      setLecture({ phase: 'echec', quoi: null, message: e instanceof ImageIllisible ? e.message : 'L’image n’a pas pu être préparée : reprenez la photo.' });
    }
  }, []);

  const photographier = async () => {
    const v = video.current;
    if (!v || v.readyState < 2 || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
    if (!blob) {
      setMode('photo');
      setLecture({ phase: 'echec', quoi: null, message: 'La photo n’a pas pu être prise : réessayez, ou choisissez une image de l’appareil.' });
      return;
    }
    await preparer(blob);
  };

  const ouvrirFichier = (avecCapture: boolean) => {
    const el = fichier.current;
    if (!el) return;
    if (avecCapture) el.setAttribute('capture', 'environment');
    else el.removeAttribute('capture');
    el.click();
  };

  const fichierChoisi = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) await preparer(f);
  };

  const lancer = async (quoi: Quoi) => {
    if (!image) return;
    const corps = () => {
      const fd = new FormData();
      fd.append('image', image.blob, 'etiquette.jpg');
      return fd;
    };
    const base = ean ? `/api/v1/produits/${encodeURIComponent(ean)}` : null;
    if (quoi === 'logo' || quoi === 'les_deux') {
      setLecture({ phase: 'envoi', etape: 'logo' });
      const r = await appel<ResultatLectureLogo>(base ? `${base}/logo` : '/api/v1/logos/lire', { method: 'POST', body: corps() });
      if (!r.ok) {
        setLecture({ phase: 'echec', message: phraseErreur(r), quoi });
        return;
      }
      if (!base) {
        setLecture({ phase: 'resultat', resultat: r.data });
        return;
      }
      if (quoi === 'logo') {
        navigate(`/produit/${ean}/logo`, { replace: true, state: { resultat: r.data } });
        return;
      }
      setLecture({ phase: 'envoi', etape: 'ingredients' });
      const o = await appel<TranscriptionOcr>(`${base}/ingredients/ocr`, { method: 'POST', body: corps() });
      navigate(`/produit/${ean}/logo`, { replace: true, state: { resultat: r.data, transcription: o.ok ? o.data : null, erreurOcr: o.ok ? null : phraseErreur(o) } });
      return;
    }
    if (!base) return;
    setLecture({ phase: 'envoi', etape: 'ingredients' });
    const o = await appel<TranscriptionOcr>(`${base}/ingredients/ocr`, { method: 'POST', body: corps() });
    if (!o.ok) {
      setLecture({ phase: 'echec', message: phraseErreur(o), quoi });
      return;
    }
    navigate(`/produit/${ean}/ingredients`, { replace: true, state: { transcription: o.data } });
  };

  const valider = (e: FormEvent) => {
    e.preventDefault();
    const code = normaliserCodeLu(saisie.replace(/\s/g, ''));
    if (!code) {
      setErreurSaisie('Un code-barres compte 8 à 14 chiffres.');
      return;
    }
    navigate(`/produit/${code}`);
  };

  const titre = TITRES[pour ?? (ean ? 'logo' : 'produit')];
  const refus = camera.phase === 'refus';
  const enCours = lecture.phase === 'preparation' || lecture.phase === 'envoi';
  const barre = (
    <>
      <BoutonRetour to={ean ? `/produit/${ean}` : '/'} />
      <Marque centre />
      <span className="w-tap" aria-hidden="true" />
    </>
  );
  const entreeFichier = <input ref={fichier} type="file" accept="image/*" className="cache-visuel" tabIndex={-1} aria-hidden="true" onChange={(e) => void fichierChoisi(e)} />;

  if (mode === 'photo') {
    return (
      <Ecran
        barre={barre}
        pied={
          <Bouton bloc disabled={enCours} onClick={reprendre}>
            Reprendre la photo
          </Bouton>
        }
      >
        <h1 className="text-title font-bold">
          {titre}
          <Emoji>📷</Emoji>
        </h1>
        {ean ? <p className="muet">Produit EAN {formaterEan(ean)}</p> : null}
        {lecture.phase === 'preparation' ? (
          <p className="font-bold" role="status">
            Préparation de l’image…
          </p>
        ) : null}
        {image ? (
          <figure className="m-0">
            <img src={image.url} alt="La photo prise de l’étiquette" className="w-full rounded border border-border bg-surface-2 object-contain" style={{ maxHeight: '46vh' }} />
            <figcaption className="muet mt-1 text-center">{decrire(image)} · envoyée seulement si vous lisez, jamais gardée.</figcaption>
          </figure>
        ) : null}
        {lecture.phase === 'envoi' ? (
          <p className="text-center font-bold" role="status" aria-live="polite">
            {lecture.etape === 'logo' ? 'Lecture du logo… quelques secondes.' : 'Lecture des ingrédients… quelques secondes.'}
          </p>
        ) : null}
        {lecture.phase === 'echec' ? (
          <Bandeau ton="warn" role="alert">
            <p>{lecture.message}</p>
            {lecture.quoi && image ? (
              <Bouton variante="primaire" className="mt-2" onClick={() => void lancer(lecture.quoi as Quoi)}>
                Réessayer
              </Bouton>
            ) : null}
          </Bandeau>
        ) : null}
        {lecture.phase === 'resultat' ? (
          <PropositionsCertificateur resultat={lecture.resultat} ean={null} surReprendre={reprendre} surAssocier={reprendre} />
        ) : image && (lecture.phase === 'repos' || lecture.phase === 'echec') ? (
          <div className="flex flex-col gap-2">
            {ean ? (
              <>
                <Bouton variante={pour === 'ingredients' ? 'defaut' : 'accent'} accent={1} bloc onClick={() => void lancer('logo')}>
                  Lire le logo
                </Bouton>
                <Bouton variante={pour === 'ingredients' ? 'accent' : 'defaut'} accent={1} bloc onClick={() => void lancer('ingredients')}>
                  Lire les ingrédients
                </Bouton>
                <Bouton variante={pour ? 'defaut' : 'accent'} accent={3} bloc onClick={() => void lancer('les_deux')}>
                  Lire les deux à la suite
                </Bouton>
                <p className="muet text-center">Le logo et les ingrédients se lisent sur la même photo : cadrez les deux si vous le pouvez.</p>
              </>
            ) : (
              <>
                <Bouton variante="accent" accent={1} bloc onClick={() => void lancer('logo')}>
                  Lire le logo
                </Bouton>
                <p className="muet text-center">Les ingrédients se lisent une fois le produit identifié : photographiez d’abord son code-barres.</p>
              </>
            )}
          </div>
        ) : null}
      </Ecran>
    );
  }

  if (mode === 'manuel' || (refus && !ean)) {
    return (
      <Ecran
        barre={barre}
        pied={
          refus ? (
            <Bouton variante="accent" accent={1} bloc onClick={() => ouvrirFichier(true)}>
              Choisir une image de l’appareil
            </Bouton>
          ) : (
            <Bouton bloc onClick={reprendre}>
              Revenir à la caméra
            </Bouton>
          )
        }
      >
        <h1 className="text-title font-bold">
          {titre}
          <Emoji>📷</Emoji>
        </h1>
        <form className="flex flex-col gap-3" onSubmit={valider}>
          {refus ? (
            <Bandeau ton="warn" role="alert">
              {camera.message}
            </Bandeau>
          ) : null}
          <Champ
            id="code-manuel"
            etiquette="Code-barres"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="13 chiffres sous les barres"
            aide="EAN-13 ou EAN-8, sans espace."
            value={saisie}
            onChange={(e) => {
              setSaisie(e.target.value);
              setErreurSaisie(null);
            }}
          />
          {erreurSaisie ? (
            <Bandeau ton="warn" role="alert">
              {erreurSaisie}
            </Bandeau>
          ) : null}
          <Bouton type="submit" variante={refus ? 'defaut' : 'accent'} accent={1} bloc>
            Vérifier ce produit
          </Bouton>
        </form>
        {refus ? <p className="muet text-center">Le logo ou la liste d’ingrédients se lisent aussi sur une image de l’appareil.</p> : null}
        {entreeFichier}
      </Ecran>
    );
  }

  if (refus) {
    // Produit connu, caméra refusée : l'image vient de l'appareil.
    return (
      <Ecran
        barre={barre}
        pied={
          <Bouton variante="accent" accent={1} bloc onClick={() => ouvrirFichier(true)}>
            Choisir une image de l’appareil
          </Bouton>
        }
      >
        <h1 className="text-title font-bold">
          {titre}
          <Emoji>📷</Emoji>
        </h1>
        <p className="muet">Produit EAN {formaterEan(ean)}</p>
        <Bandeau ton="warn" role="alert">
          {camera.message}
        </Bandeau>
        <p>Une photo du logo ou de la liste d’ingrédients, nette et de face, suffit : elle est réduite ici avant l’envoi, puis oubliée.</p>
        {entreeFichier}
      </Ecran>
    );
  }

  return (
    <Ecran
      barre={barre}
      pied={
        <Bouton variante="accent" accent={1} grand bloc disabled={camera.phase !== 'lecture'} onClick={() => void photographier()}>
          Photographier l’étiquette
        </Bouton>
      }
    >
      <h1 className="text-title font-bold">
        {titre}
        <Emoji>📷</Emoji>
      </h1>
      {ean ? (
        <p>
          Produit EAN {formaterEan(ean)} déjà identifié. Cadrez {pour === 'ingredients' ? 'la liste d’ingrédients' : pour === 'logo' ? 'le logo de certification' : 'le logo ou la liste d’ingrédients'}, puis photographiez : la lecture se fait sur le serveur, l’image n’est jamais gardée.
        </p>
      ) : (
        <p>Visez le code-barres : il se lit tout seul, sur votre téléphone. Le logo de certification et la liste d’ingrédients se lisent sur la même photo, d’un bouton.</p>
      )}
      <div className="relative overflow-hidden rounded border border-border bg-surface-2 shadow" style={{ aspectRatio: '3 / 4' }}>
        <video ref={video} className="h-full w-full object-cover" playsInline muted autoPlay aria-label="Aperçu de la caméra" />
        {/* Le viseur : quatre coins arrondis, un accent chacun (décoration ; le texte dessous dit quoi faire). */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-[10%] top-1/2 h-[32%] -translate-y-1/2">
          <span className="viseur-coin viseur-coin-1" />
          <span className="viseur-coin viseur-coin-2" />
          <span className="viseur-coin viseur-coin-3" />
          <span className="viseur-coin viseur-coin-4" />
        </div>
      </div>
      <p className="text-center font-bold" role="status">
        {camera.phase === 'demande' ? 'Un instant, la caméra s’allume…' : ean ? 'Centrez l’étiquette entre les quatre coins, puis photographiez.' : 'Centrez le code entre les quatre coins : on lit. Ou photographiez l’étiquette.'}
      </p>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        <button type="button" className="lien" onClick={() => ouvrirFichier(false)}>
          Choisir une image de l’appareil
        </button>
        {ean ? null : (
          <button type="button" className="lien" onClick={() => setMode('manuel')}>
            Saisir le code à la main
          </button>
        )}
      </div>
      {entreeFichier}
    </Ecran>
  );
}
