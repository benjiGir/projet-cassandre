import { CornerFrame } from "../../../components/layout/CornerFrame/CornerFrame";
import { useGameStore } from "../../../../game/hud/state";
import { formatViews } from "../../../lib/format";
import { HeroFace } from "../HeroFace/HeroFace";
import styles from "./LiveCam.module.css";

// see: docs/journal/portrait-stream-2026-10.md
export function LiveCam() {
  const dead = useGameStore((s) => s.flowState === "dead");
  const followers = useGameStore((s) => s.debug.followers);
  return (
    <div className={styles.cam} data-dead={dead}>
      <div className={styles.badge}>
        <span className={styles.lamp} aria-hidden="true" /> {dead ? "HORS LIGNE" : "EN DIRECT"}
      </div>
      <CornerFrame className={styles.frame}>
        <HeroFace />
      </CornerFrame>
      <div className={styles.caption}>
        <span>RÉVEIL_DU_PEUPLE</span><span className={styles.subscribers}>{`${formatViews(followers)} abonnés`}</span>
      </div>
    </div>
  );
}
