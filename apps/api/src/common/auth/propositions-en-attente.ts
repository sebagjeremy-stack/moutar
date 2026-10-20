import { createHash, randomBytes } from 'node:crypto';

/**
 * Les PROPOSITIONS en attente d'une validation (lot 3, relecture) : une lecture de logo rend un JETON (16 octets
 * aléatoires, base64url) ; la validation d'un clic doit le présenter, avec le même EAN et l'un des codes proposés — sinon
 * 400 `proposition_inconnue`. Le jeton ne se garde que HACHÉ (SHA-256), en mémoire, 15 minutes ; il se CONSOMME (une
 * validation par lecture). Pur : l'horloge et l'aléa sont injectables ; les entrées expirées se purgent au fil de l'eau.
 */
export const DUREE_PROPOSITION_MS = 15 * 60 * 1000;
/** Au-delà, la plus ancienne entrée cède la place (une seule instance, en mémoire : jamais une mémoire sans borne). */
export const PROPOSITIONS_MAX = 10_000;

export interface PropositionEnAttente {
  /** Le produit de la lecture ; null pour une lecture sans produit (`POST /logos/lire`), qui ne fonde aucune validation. */
  ean: string | null;
  /** Les codes de certificateur proposés : seul l'un d'eux se valide. */
  codes: readonly string[];
}

interface Entree extends PropositionEnAttente {
  expireA: number;
}

export function hacherJeton(jeton: string): string {
  return createHash('sha256').update(jeton).digest('base64url');
}

export class PropositionsEnAttente {
  private readonly entrees = new Map<string, Entree>();

  constructor(
    private readonly maintenant: () => number = () => Date.now(),
    private readonly alea: () => string = () => randomBytes(16).toString('base64url'),
    private readonly dureeMs: number = DUREE_PROPOSITION_MS,
  ) {}

  /** Émet un jeton pour une proposition et le rend EN CLAIR (une seule fois) ; seule son empreinte est gardée. */
  emettre(p: PropositionEnAttente): string {
    this.purger();
    const jeton = this.alea();
    this.entrees.set(hacherJeton(jeton), { ean: p.ean, codes: [...p.codes], expireA: this.maintenant() + this.dureeMs });
    while (this.entrees.size > PROPOSITIONS_MAX) {
      const plusAncienne = this.entrees.keys().next().value;
      if (plusAncienne === undefined) break;
      this.entrees.delete(plusAncienne);
    }
    return jeton;
  }

  /**
   * Consomme le jeton si, et seulement si, il est connu, non expiré, émis pour CET EAN (jamais un EAN null) et que le code
   * fait partie des codes proposés — en un seul pas synchrone (deux validations concurrentes n'en réussissent qu'une).
   */
  consommer(jeton: string, ean: string, code: string): boolean {
    this.purger();
    if (typeof jeton !== 'string' || jeton.length < 8 || jeton.length > 64) return false;
    const cle = hacherJeton(jeton);
    const e = this.entrees.get(cle);
    if (!e || e.ean === null || e.ean !== ean || !e.codes.includes(code)) return false;
    this.entrees.delete(cle);
    return true;
  }

  /** Le nombre de propositions vivantes (tests, supervision). */
  get taille(): number {
    this.purger();
    return this.entrees.size;
  }

  private purger(): void {
    const t = this.maintenant();
    for (const [cle, e] of this.entrees) if (e.expireA <= t) this.entrees.delete(cle);
  }
}
