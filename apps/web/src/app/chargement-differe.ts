import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * Un écran chargé À LA DEMANDE : `/scan` ne charge pas la console, la console ne charge pas le lecteur de code-barres.
 * Après une mise en ligne, un onglet ancien peut demander un morceau disparu : une recharge, une seule, sinon l'erreur.
 */
const MARQUE = 'moutar_rechargement_morceau';

/** Une page : un composant sans propriété. */
type Page = ComponentType<Record<string, never>>;

export function differe<M extends Record<K, Page>, K extends keyof M>(charger: () => Promise<M>, nom: K): LazyExoticComponent<M[K]> {
  return lazy(async () => {
    try {
      const m = await charger();
      return { default: m[nom] };
    } catch (e) {
      let recente = false;
      try {
        const t = Number(sessionStorage.getItem(MARQUE));
        recente = Number.isFinite(t) && Date.now() - t < 60_000;
        if (!recente) sessionStorage.setItem(MARQUE, String(Date.now()));
      } catch {
        recente = true;
      }
      if (!recente && navigator.onLine !== false) {
        window.location.reload();
        return new Promise<never>(() => undefined);
      }
      throw e;
    }
  });
}
