import type { ReactNode } from "react";

import styles from "./TuningGroup.module.css";

export interface TuningGroupProps {
  title: string;
  children: ReactNode;
}

/** Un groupe de réglages sous un titre. */
export function TuningGroup({ title, children }: TuningGroupProps) {
  return (
    <div className={styles.group}>
      <h3 className={styles.title}>{title}</h3>
      {children}
    </div>
  );
}
