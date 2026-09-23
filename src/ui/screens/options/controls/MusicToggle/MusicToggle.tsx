import { useState } from "react";

import { isMusicEnabled, setMusicEnabled } from "../../../../../core/music";
import { OptionHint } from "../../fields/OptionHint/OptionHint";
import styles from "./MusicToggle.module.css";

/** Coupe ou remet la musique — le même réglage que la touche M en jeu. */
export function MusicToggle() {
  // `core/music.ts` n'est pas réactif : on garde une copie, resynchronisée à chaque bascule.
  const [enabled, setEnabled] = useState(isMusicEnabled);

  function handleToggle() {
    setMusicEnabled(!enabled);
    setEnabled(!enabled);
  }

  return (
    <div className={styles.row}>
      <span className={styles.label}>Nappe / musique</span>
      <button type="button" className={styles.toggle} aria-pressed={enabled} onClick={handleToggle}>
        {enabled ? "ACTIVÉE" : "COUPÉE"}
      </button>
      <OptionHint>(touche M en jeu)</OptionHint>
    </div>
  );
}
