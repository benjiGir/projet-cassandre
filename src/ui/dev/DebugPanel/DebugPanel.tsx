import { useGameStore } from "../../../game/state";
import { cx } from "../../lib/styleHelpers";
import styles from "./DebugPanel.module.css";

type Level = "ok" | "warn" | "bad";

/** Largeur fixe : un nombre qui gagne un chiffre ne doit pas faire trembler le panneau pendant qu'on court. */
function fmt(n: number, decimals = 2, width = 6): string {
  return n.toFixed(decimals).padStart(width, " ");
}

// Sous ce seuil, la normale du sol trahit une pente trop raide pour un sol franc.
const FLAT_NORMAL_Y = 0.7;
// Au-delà, la boucle rattrape son retard (skill `rapier-character-controller`).
const STEPS_WARNING = 2;

/**
 * Panneau de debug, DEV UNIQUEMENT (le build de production monte
 * `FpsCounter` à sa place). Il lit `state.debug` en entier : acceptable pour
 * un outil qu'on démonte, pas pour le HUD.
 * see: docs/systems/debug.md#champs-de-debugstate
 */
export function DebugPanel() {
  const debug = useGameStore((s) => s.debug);

  const hpRatio = debug.playerMaxHp > 0 ? debug.playerHp / debug.playerMaxHp : 0;
  const hpLevel: Level = hpRatio <= 0.25 ? "bad" : hpRatio <= 0.5 ? "warn" : "ok";
  const ammoEmpty = debug.shotgunAmmo <= 0;
  const ammoLevel: Level = ammoEmpty ? "bad" : debug.shotgunAmmo <= debug.shotgunMaxAmmo * 0.2 ? "warn" : "ok";
  const stepsWarning = debug.steps > STEPS_WARNING;
  const normalLevel: Level = debug.groundNormal.y >= FLAT_NORMAL_Y ? "ok" : "warn";

  return (
    <div className={styles.panel}>
      <div>{`FPS: ${debug.fps.toFixed(0).padStart(3, " ")}`}</div>
      <div>{`Jeu: ${debug.gameplayMs.toFixed(2)}ms  Phys: ${debug.physicsMs.toFixed(2)}ms  Rendu: ${debug.renderMs.toFixed(2)}ms`}</div>
      <div>{`Draw calls: ${String(debug.drawCalls).padStart(4, " ")}  Tris: ${debug.triangles}`}</div>
      <div>{`Pos: ${fmt(debug.position.x)}, ${fmt(debug.position.y)}, ${fmt(debug.position.z)}`}</div>
      <div>{`Entities: ${String(debug.entityCount).padStart(3, " ")}`}</div>
      <div>
        {"HP: "}
        <strong className={styles.level} data-level={hpLevel}>
          {`${String(debug.playerHp).padStart(3, " ")} / ${debug.playerMaxHp}`}
        </strong>
      </div>
      <div>
        {"Pompe: "}
        <strong className={styles.level} data-level={ammoLevel}>
          {`${String(debug.shotgunAmmo).padStart(3, " ")} / ${debug.shotgunMaxAmmo}`}
        </strong>
        {ammoEmpty ? "  ⚠ à sec" : ""}
      </div>
      <div>{`Secrets: ${debug.secretsFound} / ${debug.secretsTotal}`}</div>
      <div>
        <strong className={styles.level} data-level={debug.isGrounded ? "ok" : "bad"}>
          {debug.isGrounded ? "● SOL" : "○ AIR"}
        </strong>
        {`  H:${fmt(debug.horizontalSpeed)} m/s  V:${fmt(debug.verticalSpeed)} m/s`}
      </div>
      <div>
        {`Collisions: ${String(debug.numCollisions).padStart(2, " ")}   `}
        <span className={cx(styles.level, stepsWarning && styles.strong)} data-level={stepsWarning ? "warn" : "ok"}>
          {`Steps: ${String(debug.steps).padStart(2, " ")}${stepsWarning ? " ⚠ rattrapage" : ""}`}
        </span>
      </div>
      <div>
        {"Normal Y: "}
        <strong className={styles.level} data-level={normalLevel}>
          {fmt(debug.groundNormal.y, 3, 6)}
        </strong>
        {`   (x ${fmt(debug.groundNormal.x)}, z ${fmt(debug.groundNormal.z)})`}
      </div>
    </div>
  );
}
