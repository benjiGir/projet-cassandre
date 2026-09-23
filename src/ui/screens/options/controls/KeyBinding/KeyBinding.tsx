import styles from "./KeyBinding.module.css";

export interface KeyBindingProps {
  label: string;
  keyLabel: string;
  listening: boolean;
  /** La touche diffère de la touche par défaut. */
  modified: boolean;
  onRequestCapture: () => void;
}

/** Une action et sa touche, sur une ligne de la grille des contrôles. */
export function KeyBinding({ label, keyLabel, listening, modified, onRequestCapture }: KeyBindingProps) {
  return (
    <>
      <span className={styles.label}>{label}</span>
      <button
        type="button"
        className={styles.key}
        aria-pressed={listening}
        data-modified={modified}
        onClick={onRequestCapture}
      >
        {listening ? "◉ EN ATTENTE…" : keyLabel}
      </button>
    </>
  );
}
