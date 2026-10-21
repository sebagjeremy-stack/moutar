/*
 * Les accords de l'écran (21/10/2026) : un compte s'écrit avec son nom au singulier pour 0 et 1 (le français), au pluriel
 * au-delà ; le nombre est formaté en français (« 1 234 lignes »). Une seule fonction, utilisée partout où l'écran compte.
 */

/** « 0 ouvert », « 1 ouvert », « 2 ouverts » ; « 1 234 lignes ». */
export function pluriel(n: number, singulier: string, plurielForme: string): string {
  return `${n.toLocaleString('fr-FR')} ${n > 1 ? plurielForme : singulier}`;
}

/** Le mot seul, sans le nombre (« ouvert » / « ouverts ») — pour une phrase qui écrit le nombre ailleurs. */
export function accord(n: number, singulier: string, plurielForme: string): string {
  return n > 1 ? plurielForme : singulier;
}
