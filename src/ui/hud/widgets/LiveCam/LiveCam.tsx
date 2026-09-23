import { CornerFrame } from "../../../components/layout/CornerFrame/CornerFrame";
import styles from "./LiveCam.module.css";

/**
 * Webcam factice du héros, en 16:9 : la tête passe sous le badge EN DIRECT,
 * jamais derrière.
 * see: docs/systems/hud.md#hud-de-production
 */
export function LiveCam() {
  return (
    <div className={styles.cam}>
      <CornerFrame className={styles.frame}>
        <div className={styles.shoulders} />
        <div className={styles.head} />
        <div className={styles.badge}>
          <span className={styles.lamp} aria-hidden="true" /> EN DIRECT
        </div>
      </CornerFrame>
      <div className={styles.caption}>RÉVEIL_DU_PEUPLE — 200 abonnés</div>
    </div>
  );
}
