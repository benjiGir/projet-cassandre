import styles from "./RangeField.module.css";

export interface RangeFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Texte affiché à droite du curseur (« 75° », « 100 % »). */
  display: string;
  onChange: (value: number) => void;
}

/** Un curseur et sa valeur lisible. */
export function RangeField({ label, value, min, max, step, display, onChange }: RangeFieldProps) {
  return (
    <div className={styles.field}>
      <input
        className={styles.slider}
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output className={styles.value}>{display}</output>
    </div>
  );
}
