import type { LigneAnalysee } from '@moutar/shared-types';
import { normaliser } from '@moutar/shared-types/regles/normalisation';
import { codeMention, rubriqueReservee, type ResultatAnalyseListe } from './analyse-liste-commun';

/**
 * Analyseur PUR d'un CSV `rubrique;marque;produit;mention` (séparateur « ; », « , » ou tabulation, deviné sur la
 * première ligne ; en-tête facultatif). Une ligne sans marque ni produit vaut « toute marque » dans sa rubrique, sauf
 * rubrique réservée (avertissement). Mention « L », « (L) » ou « lait non surveillé » → `lait_non_surveille`.
 */
export function analyserCsv(texte: string): ResultatAnalyseListe {
  const lignes: LigneAnalysee[] = [];
  const avertissements: string[] = [];
  const brutes = texte.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (brutes.length === 0) return { lignes, avertissements: ['Fichier vide.'], note: null };
  const sep = deviner(brutes[0]);
  let depart = 0;
  if (normaliser(brutes[0]).startsWith('rubrique')) depart = 1;
  const touteMarqueVue = new Set<string>();
  let ordre = 0;
  for (let i = depart; i < brutes.length; i++) {
    const cellules = decouper(brutes[i], sep);
    const rubrique = (cellules[0] ?? '').trim();
    if (!rubrique) {
      avertissements.push(`Ligne ${i + 1} sans rubrique : ignorée.`);
      continue;
    }
    const marque = vide(cellules[1]);
    const produitLibelle = vide(cellules[2]);
    const mention = codeMention(vide(cellules[3]));
    const reservee = rubriqueReservee(rubrique);
    if (!marque && !produitLibelle) {
      if (reservee) {
        avertissements.push(`Ligne ${i + 1} : rubrique réservée « ${rubrique} » sans marque : ignorée (jamais « toute marque »).`);
        continue;
      }
      const cle = normaliser(rubrique);
      if (touteMarqueVue.has(cle)) continue;
      touteMarqueVue.add(cle);
      lignes.push({ rubrique, marque: null, produitLibelle: null, mention, touteMarque: true, rubriqueReservee: false, ordre: ordre++ });
      continue;
    }
    lignes.push({ rubrique, marque, produitLibelle, mention, touteMarque: false, rubriqueReservee: reservee, ordre: ordre++ });
  }
  return { lignes, avertissements, note: null };
}

function deviner(ligne: string): string {
  const compte = (c: string): number => ligne.split(c).length - 1;
  if (compte('\t') > 0) return '\t';
  return compte(';') >= compte(',') ? ';' : ',';
}

/** Découpe une ligne CSV simple : guillemets doubles tolérés autour d'une cellule. */
function decouper(ligne: string, sep: string): string[] {
  const cellules: string[] = [];
  let courante = '';
  let entreGuillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') {
      if (entreGuillemets && ligne[i + 1] === '"') {
        courante += '"';
        i++;
      } else entreGuillemets = !entreGuillemets;
    } else if (c === sep && !entreGuillemets) {
      cellules.push(courante);
      courante = '';
    } else courante += c;
  }
  cellules.push(courante);
  return cellules.map((c) => c.trim());
}

function vide(c: string | undefined): string | null {
  const t = (c ?? '').trim();
  return t ? t : null;
}
