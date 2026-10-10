// Une valeur gardée dans `localStorage`. Tout accès au stockage du jeu passe
// par ici : le stockage peut manquer (tests, navigation privée), être plein, ou
// contenir ce qu'une ancienne version y a laissé — aucun de ces cas ne doit
// empêcher le jeu de démarrer.

export interface Persisted<T> {
  /** La valeur gardée ; `fallback()` si rien n'est gardé, si le stockage manque ou si le contenu est refusé. */
  load(): T;
  /** Écrit la valeur. Rend `false` si elle n'a pas pu l'être : elle ne vit alors que dans cet onglet. */
  save(value: T): boolean;
}

export interface PersistedOptions {
  /** `text` : la valeur est gardée telle quelle, sans JSON (`decode` reçoit la chaîne, `save` écrit `String(value)`). */
  format?: "json" | "text";
  /** Un contenu refusé à la lecture, ou une écriture perdue. Sans rappel, l'échec est silencieux. */
  onError?: (phase: "load" | "save", error: unknown) => void;
}

/**
 * `decode` valide ce qui a été relu et lève s'il le refuse ; il peut aussi
 * réparer champ par champ et ne jamais lever (réglages).
 */
export function persisted<T>(
  key: string,
  decode: (stored: unknown) => T,
  fallback: () => T,
  { format = "json", onError }: PersistedOptions = {},
): Persisted<T> {
  return {
    load() {
      try {
        // `localStorage` lui-même peut lever (stockage interdit) : sa lecture reste dans le `try`.
        const raw = globalThis.localStorage?.getItem(key);
        if (raw === null || raw === undefined) return fallback();
        return decode(format === "text" ? raw : JSON.parse(raw));
      } catch (error) {
        onError?.("load", error);
        return fallback();
      }
    },
    save(value) {
      try {
        globalThis.localStorage.setItem(key, format === "text" ? String(value) : JSON.stringify(value));
        return true;
      } catch (error) {
        onError?.("save", error);
        return false;
      }
    },
  };
}
