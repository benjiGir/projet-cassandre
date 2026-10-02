import styles from "./NewsTicker.module.css";

export interface NewsTickerProps {
  items: readonly string[];
}

const SEPARATOR = "  ·  ";

export function NewsTicker({ items }: NewsTickerProps) {
  const line = items.join(SEPARATOR) + SEPARATOR;

  return (
    <div className={styles.ticker} aria-hidden="true">
      <div className={styles.track}>{line + line}</div>
    </div>
  );
}
