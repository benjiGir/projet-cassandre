import type { ReactNode } from "react";

import { cx } from "../../../../lib/styleHelpers";
import styles from "./TuningSection.module.css";

export interface TuningSectionProps {
  title?: string;
  hint?: string;
  /** Trait de séparation au-dessus : la section ouvre un nouveau harnais. */
  separated?: boolean;
  children: ReactNode;
}

/** Un harnais du panneau (déplacement, feedback de hit, cheats de dev). */
export function TuningSection({ title, hint, separated = false, children }: TuningSectionProps) {
  return (
    <section className={cx(styles.section, separated && styles.separated)}>
      {title && <h2 className={styles.title}>{title}</h2>}
      {hint && <p className={styles.hint}>{hint}</p>}
      {children}
    </section>
  );
}
