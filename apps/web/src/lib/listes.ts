import type { CodeListe } from '@moutar/shared-types';

/** Les listes officielles connues (catalogue en code, côté écran) : leur nom court. */
export const LIBELLE_CODE: Readonly<Record<CodeListe, string>> = { consistoire_paris: 'Consistoire de Paris', rav_wolff: 'Rav Wolff' };
export const CODES_LISTES: readonly CodeListe[] = ['consistoire_paris', 'rav_wolff'];
