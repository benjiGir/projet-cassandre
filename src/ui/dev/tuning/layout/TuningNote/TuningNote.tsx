import type { ReactNode } from "react";

import styles from "./TuningNote.module.css";

export function TuningNote({ children }: { children: ReactNode }) {
  return <p className={styles.note}>{children}</p>;
}
