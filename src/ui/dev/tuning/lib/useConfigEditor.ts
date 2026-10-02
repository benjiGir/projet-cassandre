import { useReducer } from "react";

import type { ConfigEditor } from "./tuningTypes";

/**
 * Édite un objet de config MUTABLE, celui que la boucle de jeu lit à chaque
 * pas. Exception assumée à la règle « pas d'état externe lu au rendu »,
 * réservée à `dev/` : une copie dans l'état React devrait être resynchronisée
 * à chaque variante appliquée depuis la console.
 * see: docs/6-reference/react-bonnes-pratiques.md#état
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
