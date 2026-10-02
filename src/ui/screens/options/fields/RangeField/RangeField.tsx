import styles from "./RangeField.module.css";

export interface RangeFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}

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
