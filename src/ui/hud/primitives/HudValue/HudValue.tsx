import type { ReactNode } from "react";

import { cx } from "../../../lib/styleHelpers";
import styles from "./HudValue.module.css";

export interface HudValueProps {
  /** `glow` : la valeur luit, pour le chiffre qui fait la blague (les spectateurs). */
  emphasis?: "plain" | "glow";
  className?: string;
  children: ReactNode;
}

/** Chiffre vital du HUD, lisible d'un coup d'œil. */
export function HudValue({ emphasis = "plain", className, children }: HudValueProps) {
  return <div className={cx(styles.value, styles[emphasis], className)}>{children}</div>;
}
