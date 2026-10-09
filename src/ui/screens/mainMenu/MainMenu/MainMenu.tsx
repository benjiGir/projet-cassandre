import { useState, type ReactNode } from "react";

import { Button } from "../../../components/controls/Button/Button";
import { CornerFrame } from "../../../components/layout/CornerFrame/CornerFrame";
import { RecIndicator } from "../../../components/text/RecIndicator/RecIndicator";
import { Scanlines } from "../../../components/effects/Scanlines/Scanlines";
import { Screen } from "../../../components/layout/Screen/Screen";
import { ScreenTitle } from "../../../components/text/ScreenTitle/ScreenTitle";
import { Vignette } from "../../../components/effects/Vignette/Vignette";
import { NewsTicker } from "../NewsTicker/NewsTicker";
import styles from "./MainMenu.module.css";

export interface MainMenuProps {
  onPlay: () => void;
  onContinue?: () => void;
  onChooseLevel?: () => void;
  onOptions: () => void;
  /** Revoir les panneaux d'intro — absent tant qu'ils n'ont pas été vus une première fois. */
  onReplayIntro?: () => void;
  /** Emplacement pour les outils d'auteur, rempli seulement en dev (`app/navigation/bootChoice.ts`). */
  devTools?: ReactNode;
}

const TICKER_ITEMS = [
  "SIGNAL NON AUTORISÉ",
  "200 ABONNÉS",
  "NE COUPEZ PAS LA DIFFUSION",
  "ILS SURVEILLENT CE CANAL",
];

// see: docs/archive/systems-hud.md#menu-principal-et-écran-de-choix-de-niveau
export function MainMenu({ onPlay, onContinue, onChooseLevel, onOptions, onReplayIntro, devTools }: MainMenuProps) {
  const [quitRefused, setQuitRefused] = useState(false);

  // `window.close()` ne ferme qu'un onglet ouvert par script, et échoue sans
  function handleQuit() {
    window.close();
    setQuitRefused(true);
  }

  return (
    <Screen>
      <Scanlines />
      <Vignette />
      <RecIndicator placement="corner">SIGNAL INTERCEPTÉ</RecIndicator>
      <div className={styles.camera}>CAM_04 · RÉVEIL_DU_PEUPLE</div>

      <CornerFrame className={styles.panel}>
        <ScreenTitle className={styles.title}>
          PROJET<span className={styles.cursor}>_</span>CASSANDRE
        </ScreenTitle>
        <p className={styles.tagline}>RÉVEIL_DU_PEUPLE — la vérité, en direct</p>

        {quitRefused ? (
          <p className={styles.quitRefused}>
            ERREUR — cet onglet ne peut pas se fermer lui-même. Fermez-le manuellement pour couper la diffusion.
          </p>
        ) : (
          <div className={styles.actions}>
            {onContinue && <Button size="large" variant="primary" icon="▶" onClick={onContinue}>
              CONTINUER — MÉTRO
            </Button>}
            <Button size="large" variant={onContinue ? "default" : "primary"} icon="▶" onClick={onPlay}>
              NOUVELLE PARTIE
            </Button>
            {onChooseLevel && <Button size="large" icon="▶" onClick={onChooseLevel}>CHOISIR UN NIVEAU</Button>}
            {onReplayIntro !== undefined && (
              <Button size="large" icon="▶" onClick={onReplayIntro}>
                REVOIR L'INTRODUCTION
              </Button>
            )}
            <Button size="large" icon="▶" onClick={onOptions}>
              PARAMÈTRES DU SIGNAL
            </Button>
            <Button size="large" variant="danger" icon="■" onClick={handleQuit}>
              COUPER LA DIFFUSION
            </Button>
          </div>
        )}

        {devTools}
      </CornerFrame>

      <NewsTicker items={TICKER_ITEMS} />
    </Screen>
  );
}
