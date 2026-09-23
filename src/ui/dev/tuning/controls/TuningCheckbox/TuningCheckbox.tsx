import type { ReactNode } from "react";

import styles from "./TuningCheckbox.module.css";

export interface TuningCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}

/** Une bascule du panneau de tuning. */
export function TuningCheckbox({ checked, onChange, children }: TuningCheckboxProps) {
  return (
    <label className={styles.checkbox}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {children}
    </label>
  );
}
