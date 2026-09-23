import type { ReactNode } from "react";

import { cx } from "../../../lib/styleHelpers";
import styles from "./StatusFlag.module.css";

export interface StatusFlagProps {
  /** Clignote : un état qui réclame l'attention (signal perdu). */
  blinking?: boolean;
  children: ReactNode;
}

/** Étiquette d'état encadrée, au-dessus du titre d'un écran de fin. */
export function StatusFlag({ blinking = false, children }: StatusFlagProps) {
  return <div className={cx(styles.flag, blinking && styles.blinking)}>{children}</div>;
}
