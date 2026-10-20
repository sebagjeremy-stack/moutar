/**
 * Lecture du code-barres DANS le navigateur : `BarcodeDetector` natif quand il existe (Chrome Android, Safari récent),
 * sinon ZXing (chargé à la demande). Rend l'EAN lu, ou s'arrête quand on le lui demande. Aucune image ne part du téléphone.
 */
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const;

interface DetecteurNatif {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
}
interface ConstructeurNatif {
  new (opts: { formats: readonly string[] }): DetecteurNatif;
  getSupportedFormats(): Promise<string[]>;
}

export type ArretLecture = () => void;

/** Pure : un EAN ou UPC lu est-il recevable ? (8 à 14 chiffres ; un UPC-A à 12 chiffres devient EAN-13.) */
export function normaliserCodeLu(brut: string): string | null {
  const v = brut.trim();
  if (!/^\d{8,14}$/.test(v)) return null;
  return v.length === 12 ? `0${v}` : v;
}

export async function detecteurNatifDisponible(): Promise<boolean> {
  const C = (globalThis as { BarcodeDetector?: ConstructeurNatif }).BarcodeDetector;
  if (!C) return false;
  try {
    const formats = await C.getSupportedFormats();
    return formats.includes('ean_13');
  } catch {
    return false;
  }
}

/** Lit la vidéo jusqu'au premier code recevable, puis appelle `surCode`. */
export async function lireCodeBarres(video: HTMLVideoElement, surCode: (ean: string) => void): Promise<ArretLecture> {
  if (await detecteurNatifDisponible()) {
    const C = (globalThis as unknown as { BarcodeDetector: ConstructeurNatif }).BarcodeDetector;
    const detecteur = new C({ formats: FORMATS });
    let actif = true;
    const boucle = async () => {
      while (actif) {
        if (video.readyState >= 2) {
          try {
            const codes = await detecteur.detect(video);
            const ean = codes.map((c) => normaliserCodeLu(c.rawValue)).find((x): x is string => x !== null);
            if (ean) {
              actif = false;
              surCode(ean);
              return;
            }
          } catch {
            /* image non prête : on réessaie */
          }
        }
        await new Promise((r) => setTimeout(r, 150));
      }
    };
    void boucle();
    return () => {
      actif = false;
    };
  }
  const { BrowserMultiFormatReader } = await import('@zxing/browser');
  const lecteur = new BrowserMultiFormatReader();
  let fini = false;
  const controle = await lecteur.decodeFromVideoElement(video, (resultat) => {
    if (fini || !resultat) return;
    const ean = normaliserCodeLu(resultat.getText());
    if (!ean) return;
    fini = true;
    controle.stop();
    surCode(ean);
  });
  return () => {
    fini = true;
    controle.stop();
  };
}
