import { useReducer } from "react";

export interface ConfigEditor<T extends object> {
  /** L'objet de config lui-même, lu en direct au rendu. */
  readonly values: T;
  set<K extends keyof T>(key: K, value: T[K]): void;
  /** Redessine après une mutation faite ailleurs : variante, retour aux défauts. */
  refresh(): void;
}

/**
 * Édite un objet de config MUTABLE, celui que la boucle de jeu lit à chaque
 * pas. Exception assumée à la règle « pas d'état externe lu au rendu »,
 * réservée à `dev/` : une copie dans l'état React devrait être resynchronisée
 * à chaque variante appliquée depuis la console.
 * see: docs/reference/react-bonnes-pratiques.md#état
 */
export function useConfigEditor<T extends object>(config: T): ConfigEditor<T> {
  const [, refresh] = useReducer((revision: number) => revision + 1, 0);
  return {
    values: config,
    set(key, value) {
      config[key] = value;
      refresh();
    },
    refresh,
  };
}
