import { describe, expect, it } from 'vitest';
import { imageOff, interpreterReponseOff, lireFicheOff } from './off-client';

const reponse = (status: number, corps: unknown): Response =>
  ({ status, ok: status >= 200 && status < 300, json: async () => corps }) as unknown as Response;

describe('client Open Food Facts (HTTP simulé)', () => {
  it('lit une fiche et normalise les additifs', async () => {
    const f = async () =>
      reponse(200, {
        status: 1,
        product: { product_name: 'Biscuits', brands: 'Biscuiterie du Pré', ingredients_text_fr: 'farine, E322i, sucre', additives_tags: ['en:e322i', 'en:e500ii'] },
      });
    const r = await lireFicheOff('https://off.test', '3000000000000', f as unknown as typeof fetch);
    expect(r.etat).toBe('trouve');
    if (r.etat !== 'trouve') return;
    expect(r.fiche.nom).toBe('Biscuits');
    expect(r.fiche.additifs).toEqual(['E322', 'E500']);
    expect(r.fiche.ingredientsTexte).toBe('farine, E322i, sucre');
  });
  it('envoie le User-Agent et les champs demandés', async () => {
    let urlVue = '';
    let ua = '';
    const f = async (url: string, init: RequestInit) => {
      urlVue = url;
      ua = (init.headers as Record<string, string>)['User-Agent'];
      return reponse(404, {});
    };
    await lireFicheOff('https://off.test/', '123', f as unknown as typeof fetch);
    expect(urlVue).toBe('https://off.test/api/v2/product/123.json?fields=product_name,product_name_fr,brands,image_front_url,ingredients_text_fr,ingredients_text,additives_tags');
    expect(ua).toBe('Moutar/0.1 (usage familial)');
  });
  it('404 ou status 0 → inconnu', async () => {
    expect((await lireFicheOff('https://off.test', '1', (async () => reponse(404, {})) as unknown as typeof fetch)).etat).toBe('inconnu');
    expect(interpreterReponseOff('1', { status: 0, status_verbose: 'product not found' }).etat).toBe('inconnu');
  });
  it('panne réseau ou 5xx → indisponible, jamais « inconnu »', async () => {
    const panne = async () => {
      throw new Error('ECONNREFUSED');
    };
    expect((await lireFicheOff('https://off.test', '1', panne as unknown as typeof fetch)).etat).toBe('indisponible');
    expect((await lireFicheOff('https://off.test', '1', (async () => reponse(503, {})) as unknown as typeof fetch)).etat).toBe('indisponible');
  });
  it('ne garde une image que servie en https par *.openfoodfacts.org', () => {
    expect(imageOff('https://images.openfoodfacts.org/images/products/300/000/000/0000/front_fr.4.400.jpg')).toContain('openfoodfacts.org');
    expect(imageOff('http://images.openfoodfacts.org/x.jpg')).toBeNull();
    expect(imageOff('https://images.openfoodfacts.org.evil.example/x.jpg')).toBeNull();
    expect(imageOff('https://exemple.fr/x.jpg')).toBeNull();
    expect(imageOff('pas une adresse')).toBeNull();
    expect(imageOff(null)).toBeNull();
    const r = interpreterReponseOff('1', { status: 1, product: { product_name: 'X', image_front_url: 'https://exemple.fr/x.jpg' } });
    expect(r.etat === 'trouve' && r.fiche.imageUrl).toBeNull();
  });
  it('un tag d’additif illisible est gardé tel quel (l’analyse le compte), jamais tu', () => {
    const r = interpreterReponseOff('1', { status: 1, product: { product_name: 'X', additives_tags: ['en:e322', 'en:e14xx'] } });
    expect(r.etat === 'trouve' && r.fiche.additifs).toEqual(['E322', 'en:e14xx']);
  });
  it('préfère le nom français, tolère une fiche sans ingrédients', () => {
    const r = interpreterReponseOff('1', { status: 1, product: { product_name: 'Cookies', product_name_fr: 'Biscuits', brands: '' } });
    expect(r.etat).toBe('trouve');
    if (r.etat === 'trouve') {
      expect(r.fiche.nom).toBe('Biscuits');
      expect(r.fiche.marque).toBeNull();
      expect(r.fiche.ingredientsTexte).toBeNull();
    }
  });
});
