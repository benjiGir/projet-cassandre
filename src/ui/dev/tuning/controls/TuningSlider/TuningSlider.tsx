import styles from "./TuningSlider.module.css";

export interface TuningSliderProps {
  label: string;
  unit?: string;
  decimals: number;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  /** Fin de glissement : le moment d'appliquer ce qui est trop cher à recalculer à chaque pas du curseur. */
  onCommit?: () => void;
}

/** Un curseur de tuning : libellé, valeur lisible, et le `<input type="range">`. */
export function TuningSlider({ label, unit, decimals, min, max, step, value, onChange, onCommit }: TuningSliderProps) {
  return (
    <div className={styles.slider}>
      <div className={styles.head}>
        <span>{label}</span>
        <span className={styles.value}>{`${value.toFixed(decimals)}${unit ? ` ${unit}` : ""}`}</span>
      </div>
      <input
        className={styles.input}
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onBlur={onCommit}
      />
    </div>
  );
}
