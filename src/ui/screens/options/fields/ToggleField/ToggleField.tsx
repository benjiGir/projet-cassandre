import type { ReactNode } from "react";

import { OptionHint } from "../OptionHint/OptionHint";
import styles from "./ToggleField.module.css";

export interface ToggleFieldProps {
  label: string;
  pressed: boolean;
  /** Ce que dit le bouton dans chaque état (« ACTIVÉE » / « COUPÉE »). */
  onText: string;
  offText: string;
  hint?: ReactNode;
  onToggle: () => void;
}

/** Un interrupteur nommé : libellé, bouton à deux états, explication courte. */
export function ToggleField({ label, pressed, onText, offText, hint, onToggle }: ToggleFieldProps) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <button type="button" className={styles.toggle} aria-pressed={pressed} aria-label={label} onClick={onToggle}>
        {pressed ? onText : offText}
      </button>
      {hint && <OptionHint className={styles.hint}>{hint}</OptionHint>}
    </div>
  );
}
