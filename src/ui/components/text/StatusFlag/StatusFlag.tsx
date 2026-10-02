import type { ReactNode } from "react";

import { cx } from "../../../lib/styleHelpers";
import styles from "./StatusFlag.module.css";

export interface StatusFlagProps {
  blinking?: boolean;
  children: ReactNode;
}

export function StatusFlag({ blinking = false, children }: StatusFlagProps) {
  return <div className={cx(styles.flag, blinking && styles.blinking)}>{children}</div>;
}
