import { Logger } from '@nestjs/common';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';

const logger = new Logger('ListesPdf');

export interface FichierRecu {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Vrai si les octets sont ceux d'un PDF (en-tête `%PDF`) : c'est le CONTENU qui décide, jamais l'extension ni le type annoncé. */
export function estPdf(octets: Buffer): boolean {
  return octets.length >= 4 && octets.subarray(0, 4).toString('latin1') === '%PDF';
}

/**
 * Le texte d'un fichier reçu : un PDF passe par `pdf-parse` (côté serveur, sans réseau) ; tout autre fichier est lu comme
 * du texte UTF-8 (latin-1 si l'UTF-8 ne tient pas). 422 `pdf_illisible` quand le PDF ne rend aucun texte (scan sans OCR).
 */
export async function texteDuFichier(f: FichierRecu): Promise<string> {
  if (estPdf(f.buffer)) {
    const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
    let texte: string;
    try {
      texte = (await pdfParse(f.buffer)).text;
    } catch (e) {
      // Le motif va au journal du serveur (jamais au client) : il sert à régler l'analyseur sur les vrais fichiers.
      logger.warn(`PDF « ${f.originalname} » illisible : ${e instanceof Error ? e.message : String(e)}`);
      throw new ErreurMetier(422, 'pdf_illisible', 'Ce PDF n’a pas pu être lu : convertissez-le en texte (ou collez le texte).');
    }
    if (!texte || !texte.trim()) throw new ErreurMetier(422, 'pdf_illisible', 'Ce PDF ne contient aucun texte (image scannée ?) : collez le texte de la liste.');
    return texte;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(f.buffer);
  } catch {
    return f.buffer.toString('latin1');
  }
}
