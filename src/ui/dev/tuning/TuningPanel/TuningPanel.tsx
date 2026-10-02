import { useEffect, useEffectEvent, useState } from "react";

import { DevCheats } from "../sections/DevCheats/DevCheats";
import { HitFeedbackTuning } from "../sections/hitFeedback/HitFeedbackTuning/HitFeedbackTuning";
import { MoveTuning } from "../sections/MoveTuning/MoveTuning";
import styles from "./TuningPanel.module.css";

// see: docs/archive/reference-controles.md#touches-de-dev
const TOGGLE_KEY = "Backquote";

// see: docs/archive/systems-hud.md#panneau-de-tuning-à-chaud
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
