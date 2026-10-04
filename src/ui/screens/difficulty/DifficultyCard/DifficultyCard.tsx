import type { DifficultyOptionView } from "../../../../game/hud/hudTypes";
import { formatDuration, formatPoints } from "../../../lib/format";
import styles from "./DifficultyCard.module.css";

export interface DifficultyCardProps {
  option: DifficultyOptionView;
  /** Difficulté de la dernière partie : elle porte la marque et reçoit le focus. */
  current: boolean;
  onChoose: () => void;
}

// Une difficulté de l'écran de choix : son nom, ce qu'elle change et le record
// du joueur. Toute la carte est le bouton.
export function DifficultyCard({ option, current, onChoose }: DifficultyCardProps) {
  return (
    <button type="button" className={styles.card} aria-current={current} autoFocus={current} onClick={onChoose}>
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
  );
}
