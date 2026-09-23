import { cx } from "../../../lib/styleHelpers";
import styles from "./Scanlines.module.css";

export interface ScanlinesProps {
  /** `fine` : balayage phosphore d'un écran CRT ; `bars` : bandes épaisses d'un signal qui décroche. */
  variant?: "fine" | "bars";
}

/** Lignes de balayage plein cadre, dans la couleur du ton de l'écran. */
export function Scanlines({ variant = "fine" }: ScanlinesProps) {
  return <div className={cx(styles.scanlines, styles[variant])} aria-hidden="true" />;
}
