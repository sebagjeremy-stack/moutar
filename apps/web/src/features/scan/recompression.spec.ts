import { describe, expect, it } from 'vitest';
import { dimensionsReduites, ImageIllisible, qualitesEssayees, RECOMPRESSION_PHOTO, recompresser, type OutilsImage } from './recompression';

/** Un canvas simulé : note les dimensions demandées et rend un JPEG dont la taille dépend de la qualité et de la surface. */
function outilsSimules(largeur: number, hauteur: number, octetsParPixelEtQualite = 2) {
  const toiles: Array<{ largeur: number; hauteur: number; qualites: number[] }> = [];
  let liberee = false;
  const outils: OutilsImage = {
    async decoder() {
      return { largeur, hauteur, source: {} as CanvasImageSource, liberer: () => { liberee = true; } };
    },
    creerToile(l, h) {
      const toile = { largeur: l, hauteur: h, qualites: [] as number[] };
      toiles.push(toile);
      return {
        dessiner() {},
        async versJpeg(qualite) {
          toile.qualites.push(qualite);
          return new Blob([new Uint8Array(Math.round(l * h * qualite * octetsParPixelEtQualite))], { type: 'image/jpeg' });
        },
      };
    },
  };
  return { outils, toiles, estLiberee: () => liberee };
}

describe('dimensionsReduites (pure)', () => {
  it('ramène le plus grand côté à 1 600, proportions gardées', () => {
    expect(dimensionsReduites(4000, 3000, 1600)).toEqual({ largeur: 1600, hauteur: 1200 });
    expect(dimensionsReduites(3000, 4000, 1600)).toEqual({ largeur: 1200, hauteur: 1600 });
  });
  it('n’agrandit jamais', () => {
    expect(dimensionsReduites(800, 600, 1600)).toEqual({ largeur: 800, hauteur: 600 });
  });
});

describe('qualitesEssayees (pure)', () => {
  it('de 0,85 à 0,5 par 0,1', () => {
    expect(qualitesEssayees(RECOMPRESSION_PHOTO)).toEqual([0.85, 0.75, 0.65, 0.55]);
  });
});

describe('recompresser', () => {
  it('redessine une grande photo à 1 600 px et baisse la qualité jusqu’à passer sous 4 Mo', async () => {
    // 1600 × 1200 × q × 2 octets : 0,85 → 3,26 Mo. Avec 4 octets par pixel : 0,85 → 6,5 Mo, 0,75 → 5,8, 0,65 → 5,0, 0,55 → 4,2… trop.
    const { outils, toiles, estLiberee } = outilsSimules(4000, 3000, 2);
    const r = await recompresser(new Blob([new Uint8Array(10)], { type: 'image/jpeg' }), RECOMPRESSION_PHOTO, outils);
    expect(toiles).toHaveLength(1);
    expect(toiles[0]).toMatchObject({ largeur: 1600, hauteur: 1200, qualites: [0.85] });
    expect(r).toMatchObject({ largeur: 1600, hauteur: 1200, qualite: 0.85, recompressee: true });
    expect(r.blob.size).toBeLessThanOrEqual(RECOMPRESSION_PHOTO.octetsMax);
    expect(r.blob.type).toBe('image/jpeg');
    expect(estLiberee()).toBe(true);
  });

  it('baisse la qualité par pas de 0,1, puis réduit le côté de moitié si la qualité minimale ne suffit pas', async () => {
    // 4 octets par pixel : à 1600 × 1200, même 0,55 donne 4,2 Mo ; à 800 × 600, 0,85 donne 1,6 Mo.
    const { outils, toiles } = outilsSimules(4000, 3000, 4);
    const r = await recompresser(new Blob([new Uint8Array(10)], { type: 'image/jpeg' }), RECOMPRESSION_PHOTO, outils);
    expect(toiles[0].qualites).toEqual([0.85, 0.75, 0.65, 0.55]);
    expect(toiles[1]).toMatchObject({ largeur: 800, hauteur: 600, qualites: [0.85] });
    expect(r).toMatchObject({ largeur: 800, hauteur: 600, qualite: 0.85 });
    expect(r.blob.size).toBeLessThanOrEqual(RECOMPRESSION_PHOTO.octetsMax);
  });

  it('laisse passer telle quelle une image acceptée déjà sous les bornes (aucune perte)', async () => {
    const { outils, toiles } = outilsSimules(1200, 900);
    const source = new Blob([new Uint8Array(1000)], { type: 'image/png' });
    const r = await recompresser(source, RECOMPRESSION_PHOTO, outils);
    expect(toiles).toHaveLength(0);
    expect(r.blob).toBe(source);
    expect(r).toMatchObject({ recompressee: false, qualite: null, largeur: 1200, hauteur: 900 });
  });

  it('convertit en JPEG un type que le serveur refuse (HEIC), même petit', async () => {
    const { outils, toiles } = outilsSimules(1200, 900);
    const r = await recompresser(new Blob([new Uint8Array(1000)], { type: 'image/heic' }), RECOMPRESSION_PHOTO, outils);
    expect(toiles).toHaveLength(1);
    expect(r.blob.type).toBe('image/jpeg');
    expect(r.recompressee).toBe(true);
  });

  it('une image que le navigateur ne décode pas → ImageIllisible (phrase française)', async () => {
    const outils: OutilsImage = { decoder: async () => { throw new Error('nope'); }, creerToile: () => { throw new Error('jamais'); } };
    await expect(recompresser(new Blob([new Uint8Array(10)], { type: 'image/heic' }), RECOMPRESSION_PHOTO, outils)).rejects.toBeInstanceOf(ImageIllisible);
  });
});
