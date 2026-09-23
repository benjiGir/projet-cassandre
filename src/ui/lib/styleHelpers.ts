import type { CSSProperties } from "react";

/** Assemble des noms de classe en ignorant les valeurs fausses : `cx(styles.a, isOn && styles.b)`. */
export function cx(...classes: ReadonlyArray<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Seule forme de `style` admise dans `src/ui/` : des propriétés personnalisées
 * portant une valeur calculée au rendu, que le CSS du composant consomme.
 * see: docs/reference/react-css.md#la-règle-et-ses-deux-seules-exceptions
 */
export function cssVars(vars: Readonly<Record<`--${string}`, string | number>>): CSSProperties {
  return vars as CSSProperties;
}
