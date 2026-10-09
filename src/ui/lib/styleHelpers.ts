import type { CSSProperties } from "react";

export function cx(...classes: ReadonlyArray<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Seule forme de `style` admise dans `src/ui/` : des propriétés personnalisées
 * portant une valeur calculée au rendu, que le CSS du composant consomme.
 * see: docs/6-reference/react-css.md#la-règle-et-ses-deux-seules-exceptions
 */
export function cssVars(vars: Readonly<Record<`--${string}`, string | number>>): CSSProperties {
  return vars;
}
