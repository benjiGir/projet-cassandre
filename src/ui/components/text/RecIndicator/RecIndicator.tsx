import type { ReactNode } from "react";

import { cx } from "../../../lib/styleHelpers";
import styles from "./RecIndicator.module.css";

export interface RecIndicatorProps {
  /** `inline` : suit le flux ; `corner` : épinglé en haut à gauche de l'écran. */
  placement?: "inline" | "corner";
  children: ReactNode;
}

/** Voyant rouge qui clignote devant un libellé : l'écran est une captation en cours. */
export function RecIndicator({ placement = "inline", children }: RecIndicatorProps) {
  return (
    <div className={cx(styles.indicator, placement === "corner" && styles.corner)}>
      <span className={styles.lamp} aria-hidden="true" />
      {children}
    </div>
  );
}
