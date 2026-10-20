import { getTableName } from 'drizzle-orm';

/*
 * Outil des tests de service SANS base : un faux exécuteur enregistre chaque chaîne Drizzle (`insert(table).values(...)
 * .returning()`, `select().from(table).where(...)`, `execute(sql)`) et répond par une valeur choisie selon la chaîne. Une
 * transaction reçoit son propre enregistreur : on vérifie que tout passe par elle, et dans quel ordre.
 */
export interface Appel {
  methode: string;
  args: unknown[];
}
export type Chaine = Appel[];

/** Le nom de la table d'une chaîne (`insert`, `update`, `delete`, `from`), ou `?`. */
export function nomTable(chaine: Chaine): string {
  const a = chaine.find((c) => c.methode === 'insert' || c.methode === 'update' || c.methode === 'delete' || c.methode === 'from');
  return a ? getTableName(a.args[0] as Parameters<typeof getTableName>[0]) : '?';
}

/** Les valeurs écrites par une chaîne (`values` ou `set`). */
export const valeurs = (chaine: Chaine): Record<string, unknown> => chaine.find((c) => c.methode === 'values' || c.methode === 'set')!.args[0] as Record<string, unknown>;

/** Une chaîne décrite en un mot : « insert journal_admin », « execute ». */
export const resume = (chaine: Chaine): string => (chaine[0]?.methode === 'execute' ? 'execute' : `${chaine[0]?.methode} ${nomTable(chaine)}`);

export function enregistreur(reponse: (chaine: Chaine) => unknown) {
  const chaines: Chaine[] = [];
  const nouvelle = (): unknown => {
    const chaine: Chaine = [];
    chaines.push(chaine);
    const proxy: unknown = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(reponse(chaine));
          return (...args: unknown[]) => {
            chaine.push({ methode: String(prop), args });
            return proxy;
          };
        },
      },
    );
    return proxy;
  };
  const demarrer = (methode: string) => (...args: unknown[]) => (nouvelle() as Record<string, (...a: unknown[]) => unknown>)[methode](...args);
  const executeur = { insert: demarrer('insert'), update: demarrer('update'), select: demarrer('select'), delete: demarrer('delete'), execute: demarrer('execute') };
  return { chaines, executeur };
}

/** Une base simulée avec sa transaction : `db` et `tx` sont les chaînes enregistrées de chaque côté. */
export function baseSimulee(reponse: (chaine: Chaine) => unknown, reponseTx: (chaine: Chaine) => unknown = reponse) {
  const db = enregistreur(reponse);
  const tx = enregistreur(reponseTx);
  const faux = { ...db.executeur, transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx.executeur) };
  return { faux, db: db.chaines, tx: tx.chaines };
}
