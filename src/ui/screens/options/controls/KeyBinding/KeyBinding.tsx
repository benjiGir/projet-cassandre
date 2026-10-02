import styles from "./KeyBinding.module.css";

export interface KeyBindingProps {
  label: string;
  keyLabel: string;
  listening: boolean;
  modified: boolean;
  onRequestCapture: () => void;
}

export function KeyBinding({ label, keyLabel, listening, modified, onRequestCapture }: KeyBindingProps) {
  return (
    <>
      <span className={styles.label}>{label}</span>
      <button
        type="button"
        className={styles.key}
        aria-label={`${label} : ${listening ? "en attente d'une touche" : keyLabel}`}
        aria-pressed={listening}
        data-modified={modified}
        onClick={onRequestCapture}
      >
        {listening ? "◉ EN ATTENTE…" : keyLabel}
      </button>
    </>
  );
}
