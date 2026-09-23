import styles from "./TvStatic.module.css";

/** Neige d'un signal perdu, qui scintille par paliers. */
export function TvStatic() {
  return <div className={styles.static} aria-hidden="true" />;
}
