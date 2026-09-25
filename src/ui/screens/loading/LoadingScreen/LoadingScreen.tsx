import { RecIndicator } from "../../../components/text/RecIndicator/RecIndicator";
import { Button } from "../../../components/controls/Button/Button";
import { Scanlines } from "../../../components/effects/Scanlines/Scanlines";
import { Screen } from "../../../components/layout/Screen/Screen";
import { ScreenTitle } from "../../../components/text/ScreenTitle/ScreenTitle";
import { cssVars } from "../../../lib/styleHelpers";
import { useLoadingStatus } from "./useLoadingStatus";
import styles from "./LoadingScreen.module.css";

export interface LoadingScreenProps {
  title?: string;
}

/**
 * Écran de chargement : vraie progression, et un reflet qui glisse sur la
 * barre. Le reflet est une animation CSS de `transform`, jouée par le
 * compositeur : c'est la seule chose qui bouge encore quand la construction
 * des colliders bloque le fil principal.
 * see: docs/systems/hud.md#écran-de-chargement
 */
export function LoadingScreen({ title = "PROJET_CASSANDRE" }: LoadingScreenProps) {
  const { status, label, percent, quip, message, retry } = useLoadingStatus();

  return (
    <Screen>
      <Scanlines />
      <div className={styles.stack}>
        <RecIndicator>ACQUISITION DU SIGNAL</RecIndicator>
        <ScreenTitle>{title}</ScreenTitle>

        <div className={styles.progress}>
          <div className={styles.status}>
            <span>{label}</span>
            <span>{percent} %</span>
          </div>
          <div className={styles.track}>
            <div
              className={`${styles.fill} ${status === "failed" ? styles.fillFailed : ""}`}
              style={cssVars({ "--progress": percent / 100 })}
            />
            {status === "loading" && <div className={styles.sheen} />}
          </div>
        </div>

        {status === "failed" ? (
          <div className={styles.failure} role="alert">
            <p className={styles.failureMessage}>{message}</p>
            <Button variant="primary" onClick={() => retry?.()}>
              RÉESSAYER
            </Button>
          </div>
        ) : (
          <p className={styles.quip}>{quip}</p>
        )}
      </div>
    </Screen>
  );
}
