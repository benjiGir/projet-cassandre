import type { ReactNode } from "react";

import { cx } from "../../../lib/styleHelpers";
import styles from "./ButtonRow.module.css";

export interface ButtonRowProps {
  /** Marges et séparateurs : ils appartiennent à l'écran. */
  className?: string;
  children: ReactNode;
}

/** Une rangée de boutons centrée. */
export function ButtonRow({ className, children }: ButtonRowProps) {
  return <div className={cx(styles.row, className)}>{children}</div>;
}
