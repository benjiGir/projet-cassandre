import type { ReactNode } from "react";

import { cx } from "../../../lib/styleHelpers";
import styles from "./RecIndicator.module.css";

export interface RecIndicatorProps {
  placement?: "inline" | "corner";
  children: ReactNode;
}

export function RecIndicator({ placement = "inline", children }: RecIndicatorProps) {
  return (
    <div className={cx(styles.indicator, placement === "corner" && styles.corner)}>
      <span className={styles.lamp} aria-hidden="true" />
      {children}
    </div>
  );
}
