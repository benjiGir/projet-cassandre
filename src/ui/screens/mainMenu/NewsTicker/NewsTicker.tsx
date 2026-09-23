import styles from "./NewsTicker.module.css";

export interface NewsTickerProps {
  items: readonly string[];
}

const SEPARATOR = "  ·  ";

/**
 * Bandeau d'info qui défile en bas de l'écran. Le texte est répété deux
 * fois pour que la boucle d'animation ne laisse jamais de trou.
 */
export function NewsTicker({ items }: NewsTickerProps) {
  const line = items.join(SEPARATOR) + SEPARATOR;

  return (
    <div className={styles.ticker} aria-hidden="true">
      <div className={styles.track}>{line + line}</div>
    </div>
  );
}
