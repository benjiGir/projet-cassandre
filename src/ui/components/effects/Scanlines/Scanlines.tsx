import { cx } from "../../../lib/styleHelpers";
import styles from "./Scanlines.module.css";

export interface ScanlinesProps {
  variant?: "fine" | "bars";
}

export function Scanlines({ variant = "fine" }: ScanlinesProps) {
  return <div className={cx(styles.scanlines, styles[variant])} aria-hidden="true" />;
}
