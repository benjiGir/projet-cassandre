import type { ReactNode } from "react";

import { cx } from "../../../lib/styleHelpers";
import styles from "./HudValue.module.css";

export interface HudValueProps {
  emphasis?: "plain" | "glow";
  className?: string;
  children: ReactNode;
}

export function HudValue({ emphasis = "plain", className, children }: HudValueProps) {
  return <div className={cx(styles.value, styles[emphasis], className)}>{children}</div>;
}
