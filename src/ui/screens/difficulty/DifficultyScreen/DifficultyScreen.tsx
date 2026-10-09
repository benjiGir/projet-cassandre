import type { DifficultyOptionView } from "../../../../game/hud/hudTypes";
import { Button } from "../../../components/controls/Button/Button";
import { ButtonRow } from "../../../components/controls/ButtonRow/ButtonRow";
import { CornerFrame } from "../../../components/layout/CornerFrame/CornerFrame";
import { RecIndicator } from "../../../components/text/RecIndicator/RecIndicator";
import { Scanlines } from "../../../components/effects/Scanlines/Scanlines";
import { Screen } from "../../../components/layout/Screen/Screen";
import { ScreenTitle } from "../../../components/text/ScreenTitle/ScreenTitle";
import { Vignette } from "../../../components/effects/Vignette/Vignette";
import { DifficultyCard } from "../DifficultyCard/DifficultyCard";
import styles from "./DifficultyScreen.module.css";

export interface DifficultyScreenProps {
  options: readonly DifficultyOptionView[];
  /** Difficulté de la dernière partie. */
  selected: DifficultyOptionView["id"];
  onChoose: (id: DifficultyOptionView["id"]) => void;
  onBack: () => void;
  title?: string;
}

// Choix de la difficulté, entre le menu et le chargement. Un clic choisit ET
// lance : l'écran ne persiste rien lui-même, `bootChoice.ts` s'en charge.
export function DifficultyScreen({
  options,
  selected,
  onChoose,
  onBack,
  title = "QUI ENTRE DANS LE MAGASIN ?",
}: DifficultyScreenProps) {
  return (
    <Screen>
      <Scanlines />
      <Vignette />
      <RecIndicator placement="corner">PROFIL DU VISITEUR</RecIndicator>

      <CornerFrame className={styles.panel}>
        <ScreenTitle className={styles.title}>{title}</ScreenTitle>

        <div className={styles.options}>
          {options.map((option) => (
            <DifficultyCard
              key={option.id}
              option={option}
              current={option.id === selected}
              onChoose={() => onChoose(option.id)}
            />
          ))}
        </div>

        <ButtonRow className={styles.footer}>
          <Button onClick={onBack}>◀ RETOUR</Button>
        </ButtonRow>
      </CornerFrame>
    </Screen>
  );
}
