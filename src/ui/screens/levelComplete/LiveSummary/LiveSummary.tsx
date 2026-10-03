import type { LiveRecap } from "../../../../game/hud/hudTypes";
import { StatusFlag } from "../../../components/text/StatusFlag/StatusFlag";
import { formatViews } from "../../../lib/format";
import styles from "./LiveSummary.module.css";

export interface LiveSummaryProps {
  live: LiveRecap;
}

// Bilan du direct sur l'écran de fin : l'audience a explosé, et la plateforme
// garde tout. Informatif, sans effet sur le score.
// see: docs/2-fonctionnel/histoire.md#larc-en-cinq-temps
export function LiveSummary({ live }: LiveSummaryProps) {
  return (
    <div className={styles.summary} data-tone="alert">
      <StatusFlag blinking>VIDÉO DÉMONÉTISÉE</StatusFlag>
      <dl className={styles.figures}>
        <div className={styles.figure}>
          <dt>Pic d'audience</dt>
          <dd>{`${formatViews(live.peakViewers)} spectateurs`}</dd>
        </div>
        <div className={styles.figure}>
          <dt>Abonnés</dt>
          <dd>{`${formatViews(live.followers)} (+${formatViews(live.followersGained)})`}</dd>
        </div>
        <div className={styles.figure}>
          <dt>{`Dons reçus (${live.donationCount})`}</dt>
          <dd>
            {`${formatViews(live.donations)} €`} <span className={styles.withheld}>retenus par la plateforme</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}
