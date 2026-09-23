import type { ReactNode } from "react";

import styles from "./Screen.module.css";

export type ScreenTone = "signal" | "alert";

export interface ScreenProps {
  /** Couleur de tout ce qui est posé dedans, transmise par la cascade CSS. */
  tone?: ScreenTone;
  children: ReactNode;
}

/**
 * Racine plein écran d'un écran modal : fond, ton, centrage du contenu, et
 * capture de la souris (le calque du HUD, lui, la laisse passer).
 * see: docs/reference/react-composition.md#les-primitives-didentité
 */
export function Screen({ tone = "signal", children }: ScreenProps) {
  return (
    <div className={styles.screen} data-tone={tone}>
      {children}
    </div>
  );
}
