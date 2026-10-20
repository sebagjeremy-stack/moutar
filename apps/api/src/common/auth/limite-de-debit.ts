/**
 * Limite de débit SIMPLE, en mémoire : N demandes par fenêtre glissante, par clé (compte, e-mail, adresse).
 * Pure et testable ; l'horloge est injectable. Suffit à un usage familial sur une seule instance.
 */
export class LimiteDeDebit {
  private readonly tentatives = new Map<string, number[]>();

  constructor(
    private readonly limite: number,
    private readonly fenetreMs: number,
    private readonly maintenant: () => number = () => Date.now(),
  ) {}

  /** Enregistre une tentative et dit si elle est permise. */
  tenter(cle: string): boolean {
    const t = this.maintenant();
    const recentes = (this.tentatives.get(cle) ?? []).filter((x) => t - x < this.fenetreMs);
    if (recentes.length >= this.limite) {
      this.tentatives.set(cle, recentes);
      return false;
    }
    recentes.push(t);
    this.tentatives.set(cle, recentes);
    // Hygiène : on oublie les clés mortes de temps en temps.
    if (this.tentatives.size > 10_000) this.purger(t);
    return true;
  }

  /** Oublie les tentatives d'une clé (une connexion RÉUSSIE remet les compteurs à zéro). */
  oublier(cle: string): void {
    this.tentatives.delete(cle);
  }

  /** Les tentatives restantes pour une clé. */
  restantes(cle: string): number {
    const t = this.maintenant();
    const recentes = (this.tentatives.get(cle) ?? []).filter((x) => t - x < this.fenetreMs);
    return Math.max(0, this.limite - recentes.length);
  }

  private purger(t: number): void {
    for (const [cle, liste] of this.tentatives) {
      if (liste.every((x) => t - x >= this.fenetreMs)) this.tentatives.delete(cle);
    }
  }
}
