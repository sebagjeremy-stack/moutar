import { describe, expect, it } from 'vitest';
import { correspondanceListe, correspondanceListes, listePerimee, type ListeActive } from './correspondance-liste-regles';

const ligne = (n: number, rubrique: string, marque: string | null, produitLibelle: string | null = null, extra: Partial<ListeActive['lignes'][number]> = {}) => ({
  id: `l${n}`,
  rubrique,
  marque,
  produitLibelle,
  mention: null,
  touteMarque: false,
  rubriqueReservee: false,
  ...extra,
});

const consistoire: ListeActive = {
  id: 'c1',
  code: 'consistoire_paris',
  titre: 'Consistoire de Paris — Produits 2025-2026',
  publieLe: '2025-07-01',
  valableJusquAu: '2027-07-31',
  lignes: [
    ligne(1, 'BISCUITS SECS', 'Lu'),
    ligne(2, 'BISCUITS SECS', 'Saint Michel', null, { mention: 'lait_non_surveille' }),
    ligne(3, 'BISCUITS SECS', 'Bonne Maman', 'Tartelettes fraise'),
    ligne(4, 'YAOURTS', null, null, { touteMarque: true }),
    ligne(5, 'CHARCUTERIE', 'Zelbo', null, { rubriqueReservee: true }),
    ligne(6, 'CONFISERIE', null, 'Nougat de Montélimar'),
    ligne(7, 'PÂTES', null, null, { touteMarque: true, mention: 'lait_non_surveille' }),
  ],
};

const AUJOURDHUI = '2026-10-20';

describe('correspondanceListe (niveau 2, règle pure)', () => {
  it('cite une marque nommée, en mots entiers, confiance forte quand la rubrique est dans le nom', () => {
    const s = correspondanceListe({ nom: 'Biscuits petit beurre', marque: 'LU' }, consistoire, AUJOURDHUI);
    expect(s.statut).toBe('cite');
    expect(s.confiance).toBe('forte');
    expect(s.ligne?.id).toBe('l1');
    expect(s.detail).toContain('« Lu »');
    expect(s.detail).toContain("valable jusqu'au 31/07/2027");
  });
  it('« Lu » ne se lit pas dans « Lutine »', () => {
    const s = correspondanceListe({ nom: 'Biscuits', marque: 'Lutine' }, consistoire, AUJOURDHUI);
    expect(s.statut).toBe('non_cite');
    expect(s.ligne).toBeNull();
    expect(s.detail).toContain('« Lutine »');
  });
  it('la marque est lue sans accent ni casse, aussi dans le NOM du produit', () => {
    const s = correspondanceListe({ nom: 'Galettes SAINT-MICHEL pur beurre', marque: null }, consistoire, AUJOURDHUI);
    expect(s.statut).toBe('cite');
    expect(s.ligne?.id).toBe('l2');
  });
  it('porte la mention « lait non surveillé » en libellé humain', () => {
    const s = correspondanceListe({ nom: 'Galettes', marque: 'Saint Michel' }, consistoire, AUJOURDHUI);
    expect(s.mention).toBe('lait non surveillé');
    expect(s.detail).toContain('Mention : lait non surveillé');
  });
  it('marque citée sans rubrique dans le nom : cité, confiance faible, détail qui invite à vérifier', () => {
    const s = correspondanceListe({ nom: 'Pâte à tartiner', marque: 'Lu' }, consistoire, AUJOURDHUI);
    expect(s.statut).toBe('cite');
    expect(s.confiance).toBe('faible');
    expect(s.detail).toContain('vérifiez');
  });
  it('une ligne « marque + produit » ne cite que ce produit', () => {
    expect(correspondanceListe({ nom: 'Tartelettes fraise', marque: 'Bonne Maman' }, consistoire, AUJOURDHUI)).toMatchObject({ statut: 'cite', confiance: 'forte', ligne: { id: 'l3' } });
    expect(correspondanceListe({ nom: 'Madeleines', marque: 'Bonne Maman' }, consistoire, AUJOURDHUI).statut).toBe('non_cite');
  });
  it('une ligne « produit seul » cite par le nom', () => {
    const s = correspondanceListe({ nom: 'Nougat de Montélimar tendre', marque: 'Arnaud Soubeyran' }, consistoire, AUJOURDHUI);
    expect(s.statut).toBe('cite');
    expect(s.ligne?.id).toBe('l6');
  });
  it('une rubrique « toute marque » cite par rubrique, confiance faible, sur un mot du nom (pluriel toléré)', () => {
    const s = correspondanceListe({ nom: 'Yaourt nature', marque: 'Danone' }, consistoire, AUJOURDHUI);
    expect(s.statut).toBe('cite_par_rubrique');
    expect(s.confiance).toBe('faible');
    expect(s.detail).toContain('toute marque autorisée');
    expect(s.detail).toContain('« yaourt »');
    expect(s.ligne?.id).toBe('l4');
  });
  it('une rubrique « toute marque » porte sa mention', () => {
    expect(correspondanceListe({ nom: 'Pâtes complètes', marque: 'Panzani' }, consistoire, AUJOURDHUI).mention).toBe('lait non surveillé');
  });
  it('une rubrique réservée ne cite que ses marques nommées', () => {
    expect(correspondanceListe({ nom: 'Saucisson de bœuf', marque: 'Zelbo' }, consistoire, AUJOURDHUI).statut).toBe('cite');
    expect(correspondanceListe({ nom: 'Charcuterie de volaille', marque: 'Autre' }, consistoire, AUJOURDHUI).statut).toBe('non_cite');
  });
  it('une marque nommée l’emporte sur une rubrique « toute marque »', () => {
    const s = correspondanceListe({ nom: 'Yaourt aux biscuits', marque: 'Lu' }, consistoire, AUJOURDHUI);
    expect(s.statut).toBe('cite');
    expect(s.ligne?.id).toBe('l1');
  });
  it('liste périmée : cité devient « perime », le détail le dit', () => {
    const s = correspondanceListe({ nom: 'Biscuits', marque: 'Lu' }, consistoire, '2027-08-01');
    expect(s.statut).toBe('perime');
    expect(s.detail).toContain('PÉRIMÉE depuis le 31/07/2027');
    expect(listePerimee(consistoire, '2027-07-31')).toBe(false);
    expect(listePerimee({ valableJusquAu: null }, '2099-01-01')).toBe(false);
  });
  it('un produit non cité par une liste périmée reste « non_cite »', () => {
    expect(correspondanceListe({ nom: 'Inconnu', marque: 'Nulle part' }, consistoire, '2026-08-01').statut).toBe('non_cite');
  });
  it('un libellé de produit trop court (moins de 4 lettres) ne cite rien', () => {
    const liste: ListeActive = { ...consistoire, lignes: [ligne(9, 'THÉS', null, 'Thé')] };
    expect(correspondanceListe({ nom: 'Thé vert', marque: null }, liste, AUJOURDHUI).statut).toBe('non_cite');
  });
  it('correspondanceListes rend une sous-ligne par liste, dans l’ordre', () => {
    const wolff: ListeActive = { id: 'w', code: 'rav_wolff', titre: 'Rav Wolff 2026', publieLe: '2026-01-01', valableJusquAu: '2026-11-01', lignes: [ligne(20, 'Biscuits', 'Gerblé')] };
    const s = correspondanceListes({ nom: 'Biscuits', marque: 'Lu' }, [consistoire, wolff], AUJOURDHUI);
    expect(s.map((x) => [x.code, x.statut])).toEqual([
      ['consistoire_paris', 'cite'],
      ['rav_wolff', 'non_cite'],
    ]);
  });
});
