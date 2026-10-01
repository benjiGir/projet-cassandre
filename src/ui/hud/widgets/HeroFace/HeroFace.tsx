import { useGameStore } from "../../../../game/state";
import { cssVars } from "../../../lib/styleHelpers";
import styles from "./HeroFace.module.css";

/** Affiche l'image résolue par le jeu ; aucune horloge ni décision de réaction ici.
 * see: docs/journal/portrait-stream-2026-10.md */
export function HeroFace() {
  const frame = useGameStore((s) => s.heroPortrait.frame);
  const sheet = useGameStore((s) => s.heroPortrait.sheet);
  const reaction = useGameStore((s) => s.heroPortrait.reaction);
  const healthBand = useGameStore((s) => s.heroPortrait.healthBand);
  const side = useGameStore((s) => s.heroPortrait.side);
  const impact = useGameStore((s) => s.heroPortrait.impact);
  const combo = useGameStore((s) => s.heroPortrait.combo);
  const flow = useGameStore((s) => s.flowState);
  const dead = flow === "dead" || reaction === "dead";
  const atlas = dead ? "ambient" : sheet;
  const columns = atlas === "ambient" ? 4 : 6;
  const selectedFrame = dead ? 19 : frame;

  return (
    <div className={styles.portrait} data-reaction={dead ? "dead" : reaction}
      data-health={dead ? 4 : healthBand} data-paused={flow === "paused"} data-combo={combo}
      role="img" aria-label={dead ? "Le héros s’effondre, signal perdu" : "Retour de stream du héros"}>
      <div className={styles.impact} key={impact} data-hit={reaction === "hurt"}
        style={cssVars({ "--hit-shift": side === "left" ? -1 : side === "right" ? 1 : 0 })}>
        <div className={styles.face} data-atlas={atlas} style={cssVars({
          "--face-x": `${(selectedFrame % columns) * 100 / (columns - 1)}%`,
          "--face-y": `${Math.floor(selectedFrame / columns) * 25}%`,
        })} />
      </div>
      {reaction === "hurt" && <div className={styles.interference} key={`hit-${impact}`} aria-hidden="true" />}
      {dead && <span className={styles.signalLost}>SIGNAL PERDU</span>}
    </div>
  );
}
