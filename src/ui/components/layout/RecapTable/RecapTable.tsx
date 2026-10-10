import { cx, cssVars } from "../../../lib/styleHelpers";
import { formatPoints } from "../../../lib/format";
import styles from "./RecapTable.module.css";

/** Ce que le tableau affiche d'un récapitulatif : la primitive ne connaît pas le type du jeu. */
export interface RecapTableData {
  readonly difficulty: string;
  readonly lines: readonly { readonly label: string; readonly detail: string; readonly points: number }[];
  readonly total: number;
  readonly record: { readonly best: number; readonly isNew: boolean } | null;
}

export interface RecapTableProps {
  recap: RecapTableData | null;
  className?: string;
}

// see: docs/archive/systems-session.md#récapitulatif-de-fin-de-partie
export function RecapTable({ recap, className }: RecapTableProps) {
  if (!recap) return null;

  return (
    <div className={cx(styles.table, className)}>
      <p className={styles.difficulty}>{`Difficulté : ${recap.difficulty}`}</p>
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
      {recap.record && (
        <p className={styles.record} data-new={recap.record.isNew}>
          {recap.record.isNew ? "NOUVEAU RECORD" : `Record : ${formatPoints(recap.record.best)}`}
        </p>
      )}
    </div>
  );
}
