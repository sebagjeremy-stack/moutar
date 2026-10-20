/**
 * Recompression d'une photo DANS le navigateur, avant l'envoi au serveur (lot 3) : au plus 1 600 px de côté et 4 Mo, en
 * JPEG — le serveur accepte 8 Mo, le fournisseur Claude 5 Mo en base64, et une photo de téléphone en fait souvent plus.
 * L'image est TOUJOURS redessinée (relecture des lots 3-5) : c'est ce qui applique l'orientation EXIF (une photo de
 * téléphone « dans les clous » mais couchée partirait sinon telle quelle, et le moteur lirait une étiquette de côté) et ce
 * qui fait d'un HEIC que le navigateur décode un JPEG. Le coût : un ré-encodage JPEG à 0,85 pour une image déjà petite.
 * Les outils du navigateur (décodage, canvas) sont injectés : la boucle se teste avec un canvas simulé.
 * Rien n'est gardé : l'image décodée est libérée dès la fin.
 */
export interface OptionsRecompression {
  /** Le plus grand côté, en pixels. */
  coteMax: number;
  /** La taille maximale du JPEG, en octets. */
  octetsMax: number;
  qualiteDepart: number;
  qualiteMin: number;
  pasQualite: number;
}

export const RECOMPRESSION_PHOTO: OptionsRecompression = { coteMax: 1600, octetsMax: 4_000_000, qualiteDepart: 0.85, qualiteMin: 0.5, pasQualite: 0.1 };

export interface ImageDecodee {
  largeur: number;
  hauteur: number;
  source: CanvasImageSource;
  liberer(): void;
}

export interface Toile {
  dessiner(source: CanvasImageSource, largeur: number, hauteur: number): void;
  /** `null` quand le navigateur ne sait pas encoder (canvas vide, mémoire). */
  versJpeg(qualite: number): Promise<Blob | null>;
}

export interface OutilsImage {
  decoder(image: Blob): Promise<ImageDecodee>;
  creerToile(largeur: number, hauteur: number): Toile;
}

export class ImageIllisible extends Error {
  constructor() {
    super('Cette image n’a pas pu être lue par le navigateur : prenez la photo avec l’appareil, ou choisissez un JPEG.');
    this.name = 'ImageIllisible';
  }
}

/** Pure : les dimensions ramenées sous `coteMax`, proportions gardées, jamais agrandies, au moins 1 px. */
export function dimensionsReduites(largeur: number, hauteur: number, coteMax: number): { largeur: number; hauteur: number } {
  const plusGrand = Math.max(largeur, hauteur);
  if (plusGrand <= coteMax) return { largeur, hauteur };
  const facteur = coteMax / plusGrand;
  return { largeur: Math.max(1, Math.round(largeur * facteur)), hauteur: Math.max(1, Math.round(hauteur * facteur)) };
}

/** Pure : la suite des qualités essayées, de `qualiteDepart` à `qualiteMin` par `pasQualite` (arrondies au centième). */
export function qualitesEssayees(o: OptionsRecompression): number[] {
  const suite: number[] = [];
  for (let q = o.qualiteDepart; q >= o.qualiteMin - 1e-9; q -= o.pasQualite) suite.push(Math.round(q * 100) / 100);
  return suite;
}

export interface Recompressee {
  blob: Blob;
  largeur: number;
  hauteur: number;
  /** La qualité JPEG retenue. */
  qualite: number;
  /** Toujours vrai : l'image est redessinée (orientation EXIF appliquée, JPEG). */
  recompressee: true;
}

/**
 * Rend l'image à envoyer, TOUJOURS redessinée en JPEG (orientation EXIF appliquée au décodage), ramenée sous `coteMax`,
 * la qualité baissant jusqu'à passer sous `octetsMax`, puis le côté réduit de moitié si la qualité minimale n'y suffit pas
 * (trois tours au plus).
 */
export async function recompresser(image: Blob, options: OptionsRecompression = RECOMPRESSION_PHOTO, outils: OutilsImage = outilsDuNavigateur()): Promise<Recompressee> {
  let decodee: ImageDecodee;
  try {
    decodee = await outils.decoder(image);
  } catch {
    throw new ImageIllisible();
  }
  try {
    let cible = dimensionsReduites(decodee.largeur, decodee.hauteur, options.coteMax);
    let dernier: { blob: Blob; qualite: number } | null = null;
    for (let tour = 0; tour < 3; tour++) {
      const toile = outils.creerToile(cible.largeur, cible.hauteur);
      toile.dessiner(decodee.source, cible.largeur, cible.hauteur);
      for (const qualite of qualitesEssayees(options)) {
        const blob = await toile.versJpeg(qualite);
        if (!blob) throw new ImageIllisible();
        dernier = { blob, qualite };
        if (blob.size <= options.octetsMax) return { blob, largeur: cible.largeur, hauteur: cible.hauteur, qualite, recompressee: true };
      }
      cible = dimensionsReduites(cible.largeur, cible.hauteur, Math.ceil(Math.max(cible.largeur, cible.hauteur) / 2));
    }
    // Trois tours sans passer sous la borne : on envoie le dernier, le serveur tranchera (413 en phrase française).
    if (!dernier) throw new ImageIllisible();
    return { blob: dernier.blob, largeur: cible.largeur, hauteur: cible.hauteur, qualite: dernier.qualite, recompressee: true };
  } finally {
    decodee.liberer();
  }
}

/** Les vrais outils : `createImageBitmap` (orientation EXIF appliquée) ou, à défaut, un `<img>` ; un canvas HTML. */
export function outilsDuNavigateur(): OutilsImage {
  return {
    async decoder(image) {
      if (typeof createImageBitmap === 'function') {
        try {
          const bitmap = await createImageBitmap(image, { imageOrientation: 'from-image' });
          return { largeur: bitmap.width, hauteur: bitmap.height, source: bitmap, liberer: () => bitmap.close() };
        } catch {
          /* un format que createImageBitmap ne lit pas : on tente l'élément <img> (Safari décode le HEIC par là). */
        }
      }
      const url = URL.createObjectURL(image);
      try {
        const img = await new Promise<HTMLImageElement>((resoudre, rejeter) => {
          const el = new Image();
          el.onload = () => resoudre(el);
          el.onerror = () => rejeter(new Error('illisible'));
          el.src = url;
        });
        return { largeur: img.naturalWidth, hauteur: img.naturalHeight, source: img, liberer: () => URL.revokeObjectURL(url) };
      } catch (e) {
        URL.revokeObjectURL(url);
        throw e;
      }
    },
    creerToile(largeur, hauteur) {
      const canvas = document.createElement('canvas');
      canvas.width = largeur;
      canvas.height = hauteur;
      const ctx = canvas.getContext('2d');
      return {
        dessiner(source, l, h) {
          ctx?.drawImage(source, 0, 0, l, h);
        },
        versJpeg(qualite) {
          return new Promise<Blob | null>((resoudre) => canvas.toBlob((b) => resoudre(b), 'image/jpeg', qualite));
        },
      };
    },
  };
}
