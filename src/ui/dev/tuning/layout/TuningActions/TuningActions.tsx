import type { ReactNode } from "react";

import styles from "./TuningActions.module.css";

/** Rangée de boutons : défauts et variantes A/B. */
export function TuningActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}
