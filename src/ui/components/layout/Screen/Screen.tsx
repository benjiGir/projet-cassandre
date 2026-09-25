import type { ReactNode } from "react";

import styles from "./Screen.module.css";

export type ScreenTone = "signal" | "alert";
/** `opaque` : fond peint, le jeu derrière est entièrement caché (menus d'avant
 * partie, mort, fin de niveau — rien à voir derrière). `dim` : fond
 * translucide et flouté, la scène 3D reste visible en dessous, assombrie —
 * la pause seule en a besoin (`PauseScreen`, `OptionsScreen` quand elle y est
 * imbriquée). */
export type ScreenBackdrop = "opaque" | "dim";

export interface ScreenProps {
  /** Couleur de tout ce qui est posé dedans, transmise par la cascade CSS. */
  tone?: ScreenTone;
  backdrop?: ScreenBackdrop;
  children: ReactNode;
}

/**
 * Racine plein écran d'un écran modal : fond, ton, centrage du contenu, et
 * capture de la souris (le calque du HUD, lui, la laisse passer).
 * see: docs/reference/react-composition.md#les-primitives-didentité
 */
export function Screen({ tone = "signal", backdrop = "opaque", children }: ScreenProps) {
  return (
    <div className={styles.screen} data-tone={tone} data-backdrop={backdrop}>
      {children}
    </div>
  );
}
