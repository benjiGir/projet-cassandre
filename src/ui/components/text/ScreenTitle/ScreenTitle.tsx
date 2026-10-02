import type { ReactNode } from "react";

import { cx } from "../../../lib/styleHelpers";
import styles from "./ScreenTitle.module.css";

export interface ScreenTitleProps {
  /** Taille et espacement propres à l'écran. */
  className?: string;
  children: ReactNode;
}

export function ScreenTitle({ className, children }: ScreenTitleProps) {
  return <h1 className={cx(styles.title, className)}>{children}</h1>;
}
