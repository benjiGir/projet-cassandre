import styles from "./Vignette.module.css";

/** Assombrit les bords du cadre, comme l'objectif d'une caméra de surveillance. */
export function Vignette() {
  return <div className={styles.vignette} aria-hidden="true" />;
}
