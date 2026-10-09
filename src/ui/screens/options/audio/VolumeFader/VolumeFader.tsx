import { RangeField } from "../../fields/RangeField/RangeField";
import styles from "./VolumeFader.module.css";

export interface VolumeFaderProps {
  label: string;
  /** 0 à 100, la valeur affichée. */
  percent: number;
  onChange: (percent: number) => void;
  onPreview?: () => void;
}

export function VolumeFader({ label, percent, onChange, onPreview }: VolumeFaderProps) {
  return (
    <div className={styles.fader}>
      <span className={styles.label}>{label}</span>
      <RangeField
        label={`Volume ${label.toLowerCase()}`}
        min={0}
        max={100}
        step={5}
        value={percent}
        display={percent === 0 ? "MUET" : `${percent} %`}
        onChange={onChange}
      />
      {onPreview ? (
        <button
          type="button"
          className={styles.preview}
          aria-label={`Écouter : ${label.toLowerCase()}`}
          onClick={onPreview}
        >
          ▶
        </button>
      ) : (
        <span aria-hidden="true" />
      )}
    </div>
  );
}
