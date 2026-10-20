import type { Certificateur } from '../index';

/**
 * Les certificateurs reconnus en v1 (cadrage § 8.3 : dix organismes, à compléter par le médecin-utilisateur avec ceux
 * qu'il croise en rayon). Servi au lot 3 (reconnaissance du logo) ; la console pourra en désactiver (`certificateur_surcharge`).
 * Les mentions sont celles qu'un logo peut porter : elles qualifient la certification, elles ne la remplacent pas.
 */
export const MENTIONS_CERTIFICATION = ['parvé', 'halavi', 'lait surveillé', 'lait non surveillé', 'bassari', 'Pessah'] as const;

export const CERTIFICATEURS: readonly Certificateur[] = [
  { code: 'beth_din_paris', nom: 'Beth Din de Paris (Consistoire)', pays: 'France', mentions: ['parvé', 'halavi', 'lait surveillé', 'lait non surveillé', 'bassari'] },
  { code: 'rav_wolff', nom: 'Rav Wolff', pays: 'France', mentions: ['parvé', 'halavi', 'lait surveillé', 'lait non surveillé'] },
  { code: 'badatz_eda_haredit', nom: 'Badatz Eda Haredit', pays: 'Israël', mentions: ['parvé', 'halavi', 'lait surveillé', 'Pessah'] },
  { code: 'ou', nom: 'Orthodox Union (OU)', pays: 'États-Unis', mentions: ['parvé', 'halavi', 'lait non surveillé', 'Pessah'] },
  { code: 'ok', nom: 'OK Kosher', pays: 'États-Unis', mentions: ['parvé', 'halavi', 'lait non surveillé', 'Pessah'] },
  { code: 'star_k', nom: 'Star-K', pays: 'États-Unis', mentions: ['parvé', 'halavi', 'lait non surveillé', 'Pessah'] },
  { code: 'kof_k', nom: 'Kof-K', pays: 'États-Unis', mentions: ['parvé', 'halavi', 'lait non surveillé', 'Pessah'] },
  { code: 'klbd', nom: 'KLBD (London Beth Din)', pays: 'Royaume-Uni', mentions: ['parvé', 'halavi', 'lait non surveillé', 'Pessah'] },
  { code: 'rabbinat_hollande', nom: 'Rabbinat de Hollande', pays: 'Pays-Bas', mentions: ['parvé', 'halavi', 'lait non surveillé'] },
  { code: 'rabbinat_milan', nom: 'Rabbinat de Milan', pays: 'Italie', mentions: ['parvé', 'halavi', 'lait surveillé'] },
];

export const CERTIFICATEURS_PAR_CODE: ReadonlyMap<string, Certificateur> = new Map(CERTIFICATEURS.map((c) => [c.code, c]));
