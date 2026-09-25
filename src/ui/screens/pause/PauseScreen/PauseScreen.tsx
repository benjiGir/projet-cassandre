import { useEffect, useState } from "react";

import { useGameStore } from "../../../../game/state";
import { Button } from "../../../components/controls/Button/Button";
import { ButtonRow } from "../../../components/controls/ButtonRow/ButtonRow";
import { CornerFrame } from "../../../components/layout/CornerFrame/CornerFrame";
import { Scanlines } from "../../../components/effects/Scanlines/Scanlines";
import { Screen } from "../../../components/layout/Screen/Screen";
import { ScreenTitle } from "../../../components/text/ScreenTitle/ScreenTitle";
import { StatusFlag } from "../../../components/text/StatusFlag/StatusFlag";
import { Vignette } from "../../../components/effects/Vignette/Vignette";
import { OptionsScreen } from "../../options/OptionsScreen/OptionsScreen";
import styles from "./PauseScreen.module.css";

export interface PauseScreenProps {
  onResume: () => void;
  onReturnToMenu: () => void;
}

/**
 * Pause en jeu : le pas fixe continue de tourner (invariant #1), son CONTENU
 * est ignoré tant que `flowState === "paused"` (garde déjà en place dans
 * `game/loop/updateGameplay.ts`, même mécanisme que "dead"/"levelComplete").
 * Entrée déclenchée par la perte du verrouillage du pointeur (`main.ts`) —
 * ce composant ne fait qu'AFFICHER l'état, jamais décider d'y entrer.
 *
 * Réutilise `OptionsScreen` tel quel pour l'onglet "Paramètres" plutôt que
 * d'en dupliquer le câblage (`ControlsTab`/`DisplayTab` restent chacun à un
 * seul endroit) : seul le bouton RETOUR change de cible (ce menu de pause,
 * pas le menu principal). Léger écart à la règle « un écran ne connaît pas
 * un autre écran » (`docs/reference/react-composition.md`), justifié ici :
 * pas de couplage de NAVIGATION (aucun état de flux partagé), seulement une
 * composition — `OptionsScreen` reste utilisable seul, sans rien savoir de
 * la pause.
 *
 * `backdrop="dim"` (voir `components/layout/Screen/Screen.tsx`) plutôt que le
 * fond peint des autres écrans : le rendu ne s'arrête jamais en pause
 * (invariant #1, `render()` tourne à chaque frame), la scène figée reste
 * visible et assombrie derrière le panneau — propagé à `OptionsScreen` pour
 * que l'onglet Paramètres garde la même transparence.
 * see: docs/systems/session.md#pause
 */
export function PauseScreen({ onResume, onReturnToMenu }: PauseScreenProps) {
  const flowState = useGameStore((s) => s.flowState);
  const [pane, setPane] = useState<"menu" | "options">("menu");

  // Toujours repartir du menu de pause à CHAQUE nouvelle pause — sans ça,
  // fermer la pause depuis l'onglet Paramètres (Reprendre y est absent,
  // mais Échap/perte de verrouillage reste possible pendant qu'il est
  // affiché) rouvrirait directement dessus la prochaine fois.
  useEffect(() => {
    if (flowState === "paused") setPane("menu");
  }, [flowState]);

  if (flowState !== "paused") return null;

  if (pane === "options") {
    return <OptionsScreen backdrop="dim" onBack={() => setPane("menu")} />;
  }

  return (
    <Screen backdrop="dim">
      <Vignette />
      <Scanlines />
      <CornerFrame className={styles.panel}>
        <StatusFlag blinking>SIGNAL EN PAUSE</StatusFlag>
        <ScreenTitle className={styles.title}>STREAM EN PAUSE</ScreenTitle>
        <p className={styles.body}>La caméra tourne encore. Personne ne le sait.</p>

        <ButtonRow className={styles.actions}>
          <Button className={styles.actionButton} variant="primary" onClick={onResume}>
            ▶ REPRENDRE
          </Button>
          <Button className={styles.actionButton} onClick={() => setPane("options")}>
            ⚙ PARAMÈTRES
          </Button>
          <Button className={styles.actionButton} variant="danger" onClick={onReturnToMenu}>
            ◀ QUITTER VERS LE MENU
          </Button>
        </ButtonRow>
      </CornerFrame>
    </Screen>
  );
}
