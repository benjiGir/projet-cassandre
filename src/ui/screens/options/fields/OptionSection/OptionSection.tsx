import type { ReactNode } from "react";

import { OptionHint } from "../OptionHint/OptionHint";
import styles from "./OptionSection.module.css";

export interface OptionSectionProps {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}

/** Un réglage de l'écran d'options : titre, explication, puis le contrôle. */
export function OptionSection({ title, hint, children }: OptionSectionProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{title}</h2>
      {hint && <OptionHint className={styles.hint}>{hint}</OptionHint>}
      {children}
    </section>
  );
}
