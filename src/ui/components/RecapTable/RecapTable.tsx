import { type LevelRecap } from "../../../game/state";
import { cx, cssVars } from "../../lib/styleHelpers";
import { formatPoints } from "../../lib/format";
import styles from "./RecapTable.module.css";

export interface RecapTableProps {
  /** `null` = aucun récap encore publié — retourne `null`, aucune ligne de secours affichée. */
  recap: LevelRecap | null;
  className?: string;
}

/**
 * Liste de lignes de récap (fin de niveau ET mort — voir `DeathScreen`/
 * `LevelCompleteScreen`) + un total. Ne connaît AUCUNE règle de barème :
 * `label`/`detail`/`points` arrivent déjà calculés par
 * `game/session/score.ts::buildLevelRecap`. Primitive au sens de
 * `components/` : pas de lecture du store, tout par props.
 *
 * Les lignes se révèlent l'une après l'autre (`--i`, consommé par
 * `RecapTable.module.css` en `animation-delay`) — pur CSS, une seule pose de
 * variable au rendu, aucun `setInterval`/état React (invariant #2). Les
 * boutons de l'écran qui contient cette table sont des frères, jamais
 * masqués par elle : la révélation ne retarde aucune action.
 * see: docs/systems/session.md#récapitulatif-de-fin-de-partie
 */
export function RecapTable({ recap, className }: RecapTableProps) {
  if (!recap) return null;

  return (
    <div className={cx(styles.table, className)}>
      <ul className={styles.lines}>
        {recap.lines.map((line, index) => (
          <li key={line.label} className={styles.line} style={cssVars({ "--i": index })}>
            <span className={styles.label}>{line.label}</span>
            <span className={styles.detail}>{line.detail}</span>
            <span className={styles.points}>{`+${formatPoints(line.points)}`}</span>
          </li>
        ))}
      </ul>
      <div className={styles.total} style={cssVars({ "--i": recap.lines.length })}>
        <span className={styles.totalLabel}>Score total</span>
        <span className={styles.totalPoints}>{formatPoints(recap.total)}</span>
      </div>
    </div>
  );
}
