import type { ReactNode } from "react";

import styles from "./TuningActions.module.css";

export function TuningActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}
