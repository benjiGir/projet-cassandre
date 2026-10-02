import type { ReactNode } from "react";

import { cx } from "../../../lib/styleHelpers";
import styles from "./HudLabel.module.css";

export interface HudLabelProps {
  className?: string;
  children: ReactNode;
}

export function HudLabel({ className, children }: HudLabelProps) {
  return <div className={cx(styles.label, className)}>{children}</div>;
}
