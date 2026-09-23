import { useEffect, useEffectEvent, useState } from "react";

import { DevCheats } from "../sections/DevCheats/DevCheats";
import { HitFeedbackTuning } from "../sections/hitFeedback/HitFeedbackTuning/HitFeedbackTuning";
import { MoveTuning } from "../sections/MoveTuning/MoveTuning";
import styles from "./TuningPanel.module.css";

// Backquote (`/~) : la seule touche du projet que rien d'autre n'utilise.
// see: docs/reference/controles.md#touches-de-dev
const TOGGLE_KEY = "Backquote";

/**
 * Curseurs à chaud pour `moveConfig`, `weaponConfig` et `suitConfig` (skill
 * `game-feel-tuning`) : sans eux, régler le feel exige la console pendant
 * qu'on court. Fermé, le panneau est démonté — rien n'intercepte la souris.
 * Ne touche jamais au pas fixe : il mute les configs sur une action humaine,
 * jamais en tâche de fond (invariant #2).
 * see: docs/systems/hud.md#panneau-de-tuning-à-chaud
 */
export function TuningPanel() {
  const [open, setOpen] = useState(false);

  const onToggleKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.code !== TOGGLE_KEY || e.repeat) return;
    // Un curseur a besoin du pointeur : on rend la souris tout de suite.
    if (!open) document.exitPointerLock();
    setOpen(!open);
  });

  useEffect(() => {
    const listener = (e: KeyboardEvent) => onToggleKey(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  if (!open) {
    return <div className={styles.closedHint}>{"` : tuning"}</div>;
  }

  return (
    <aside className={styles.panel} aria-label="Panneau de tuning">
      <MoveTuning />
      <HitFeedbackTuning />
      <DevCheats />
      <p className={styles.footnote}>
        F9/F10 : le recorder ne restaure QUE l'état du joueur, pas les PV/positions des Costards — voir la doc de
        `IMPACT_VARIANTS`/`KNOCKBACK_VARIANTS`.
      </p>
    </aside>
  );
}
