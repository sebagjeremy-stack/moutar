import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bandeau } from '../../components/Bandeau';
import { Bouton } from '../../components/Bouton';
import { Champ } from '../../components/Champ';
import { BoutonRetour, Ecran, Marque } from '../../components/Ecran';
import { Emoji } from '../../components/Emoji';
import { lireCodeBarres, normaliserCodeLu, type ArretLecture } from './lecteur-code-barres';

type Etat = { phase: 'demande' } | { phase: 'lecture' } | { phase: 'refus'; message: string } | { phase: 'manuel' };

/** /scan : la caméra arrière lit le code-barres dans le navigateur ; dès lecture → /produit/:ean. */
export function ScanPage() {
  const navigate = useNavigate();
  const video = useRef<HTMLVideoElement>(null);
  const [etat, setEtat] = useState<Etat>({ phase: 'demande' });
  const [saisie, setSaisie] = useState('');
  const [erreurSaisie, setErreurSaisie] = useState<string | null>(null);

  useEffect(() => {
    if (etat.phase !== 'demande' && etat.phase !== 'lecture') return;
    let flux: MediaStream | null = null;
    let arret: ArretLecture | null = null;
    let annule = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setEtat({ phase: 'refus', message: 'Ce navigateur ne donne pas accès à la caméra. Saisissez le code à la main.' });
        return;
      }
      try {
        flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch (e) {
        const nom = e instanceof DOMException ? e.name : '';
        setEtat({
          phase: 'refus',
          message:
            nom === 'NotAllowedError'
              ? 'L’accès à la caméra a été refusé. Autorisez-le dans les réglages du navigateur, ou saisissez le code à la main.'
              : nom === 'NotFoundError'
                ? 'Aucune caméra trouvée sur cet appareil. Saisissez le code à la main.'
                : 'La caméra n’a pas pu démarrer. Réessayez, ou saisissez le code à la main.',
        });
        return;
      }
      if (annule || !video.current) {
        flux.getTracks().forEach((t) => t.stop());
        return;
      }
      video.current.srcObject = flux;
      await video.current.play().catch(() => undefined);
      setEtat({ phase: 'lecture' });
      arret = await lireCodeBarres(video.current, (ean) => navigate(`/produit/${ean}`, { replace: true }));
    })();
    return () => {
      annule = true;
      arret?.();
      flux?.getTracks().forEach((t) => t.stop());
    };
    // Le flux ne se (re)demande qu'à l'entrée sur la page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat.phase === 'manuel' || etat.phase === 'refus']);

  const valider = (e: FormEvent) => {
    e.preventDefault();
    const ean = normaliserCodeLu(saisie.replace(/\s/g, ''));
    if (!ean) {
      setErreurSaisie('Un code-barres compte 8 à 14 chiffres.');
      return;
    }
    navigate(`/produit/${ean}`);
  };

  const manuel = etat.phase === 'manuel' || etat.phase === 'refus';

  return (
    <Ecran
      barre={
        <>
          <BoutonRetour />
          <Marque centre />
          <span className="w-tap" aria-hidden="true" />
        </>
      }
      pied={
        manuel ? (
          <Bouton bloc onClick={() => setEtat({ phase: 'demande' })}>
            Revenir à la caméra
          </Bouton>
        ) : (
          <Bouton bloc onClick={() => setEtat({ phase: 'manuel' })}>
            Saisir le code à la main
          </Bouton>
        )
      }
    >
      <h1 className="text-title font-bold">
        Photographier le produit
        <Emoji>📷</Emoji>
      </h1>
      {manuel ? (
        <form className="flex flex-col gap-3" onSubmit={valider}>
          {etat.phase === 'refus' ? (
            <Bandeau ton="warn" role="alert">
              {etat.message}
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
          <Bouton type="submit" variante="accent" accent={1} bloc>
            Vérifier ce produit
          </Bouton>
        </form>
      ) : (
        <>
          <p>Visez le code-barres, le reste se fait tout seul. La lecture reste sur votre téléphone : aucune image ne part.</p>
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
            {etat.phase === 'demande' ? 'Un instant, la caméra s’allume…' : 'Centrez le code entre les quatre coins : on lit.'}
          </p>
          <p className="muet text-center">Bientôt, le logo de certification et la liste d’ingrédients se liront sur la même photo (lot 3).</p>
        </>
      )}
    </Ecran>
  );
}
