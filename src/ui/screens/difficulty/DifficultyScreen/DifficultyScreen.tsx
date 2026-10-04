import type { Difficulty, DifficultyEffect } from "../../../../game/session/progression/difficulty";
import type { LevelRecord } from "../../../../game/settings/records";
import { Button } from "../../../components/controls/Button/Button";
import { ButtonRow } from "../../../components/controls/ButtonRow/ButtonRow";
import { CornerFrame } from "../../../components/layout/CornerFrame/CornerFrame";
import { RecIndicator } from "../../../components/text/RecIndicator/RecIndicator";
import { Scanlines } from "../../../components/effects/Scanlines/Scanlines";
import { Screen } from "../../../components/layout/Screen/Screen";
import { ScreenTitle } from "../../../components/text/ScreenTitle/ScreenTitle";
import { Vignette } from "../../../components/effects/Vignette/Vignette";
import { formatDuration, formatPoints } from "../../../lib/format";
import styles from "./DifficultyScreen.module.css";

export interface DifficultyOption {
  id: Difficulty;
  label: string;
  pitch: string;
  effects: readonly DifficultyEffect[];
  /** Record du niveau dans cette difficulté, `null` tant qu'il n'a pas été terminé. */
  record: LevelRecord | null;
}

export interface DifficultyScreenProps {
  options: readonly DifficultyOption[];
  /** Difficulté de la dernière partie : elle reçoit le focus et sa marque. */
  selected: Difficulty;
  onChoose: (id: Difficulty) => void;
  onBack: () => void;
}

// Choix de la difficulté, entre le menu et le chargement. Un clic choisit ET
// lance : l'écran ne persiste rien lui-même, `bootChoice.ts` s'en charge.
export function DifficultyScreen({ options, selected, onChoose, onBack }: DifficultyScreenProps) {
  return (
    <Screen>
      <Scanlines />
      <Vignette />
      <RecIndicator placement="corner">PROFIL DU VISITEUR</RecIndicator>

      <CornerFrame className={styles.panel}>
        <ScreenTitle className={styles.title}>QUI ENTRE DANS LE MAGASIN ?</ScreenTitle>

        <div className={styles.options}>
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={styles.option}
              aria-current={option.id === selected}
              autoFocus={option.id === selected}
              onClick={() => onChoose(option.id)}
            >
              <span className={styles.label}>{option.label}</span>
              <span className={styles.pitch}>{option.pitch}</span>
              <span className={styles.effects}>
                {option.effects.map((effect) => (
                  <span key={effect.label} className={styles.effect}>
                    <span>{effect.label}</span>
                    <span className={styles.effectValue}>{effect.value}</span>
                  </span>
                ))}
              </span>
              <span className={styles.record}>
                {option.record
                  ? `Record : ${formatPoints(option.record.score)} · ${formatDuration(option.record.seconds)}`
                  : "Aucun record"}
              </span>
            </button>
          ))}
        </div>

        <ButtonRow className={styles.footer}>
          <Button onClick={onBack}>◀ RETOUR</Button>
        </ButtonRow>
      </CornerFrame>
    </Screen>
  );
}
