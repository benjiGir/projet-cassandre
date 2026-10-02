import type { ReactNode } from "react";

import { cx } from "../../../lib/styleHelpers";
import styles from "./CornerFrame.module.css";

export interface CornerFrameProps {
  /** Taille, marges et disposition du panneau : elles appartiennent à l'écran qui le pose. */
  className?: string;
  children?: ReactNode;
}

// see: docs/6-reference/react-composition.md#les-primitives-didentité
export function CornerFrame({ className, children }: CornerFrameProps) {
  return (
    <div className={cx(styles.frame, className)}>
      <span className={cx(styles.corner, styles.topLeft)} aria-hidden="true" />
      <span className={cx(styles.corner, styles.topRight)} aria-hidden="true" />
      <span className={cx(styles.corner, styles.bottomLeft)} aria-hidden="true" />
      <span className={cx(styles.corner, styles.bottomRight)} aria-hidden="true" />
      {children}
    </div>
  );
}
