import type { ReactNode } from "react";

import { cx } from "../../../../lib/styleHelpers";
import styles from "./OptionHint.module.css";

export interface OptionHintProps {
  className?: string;
  children: ReactNode;
}

/** Explication discrète sous un réglage : ce qu'il change à l'écran. */
export function OptionHint({ className, children }: OptionHintProps) {
  return <p className={cx(styles.hint, className)}>{children}</p>;
}
