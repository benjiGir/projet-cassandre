import type { ReactNode } from "react";

import styles from "./TuningNote.module.css";

/** Remarque en retrait sous un réglage. */
export function TuningNote({ children }: { children: ReactNode }) {
  return <p className={styles.note}>{children}</p>;
}
