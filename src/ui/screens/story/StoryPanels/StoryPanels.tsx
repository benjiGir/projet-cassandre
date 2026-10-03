import { useState } from "react";

import { assetUrl } from "../../../../core/loading/assetPath";
import type { StoryPanel } from "../../../../game/hud/hudTypes";
import { Button } from "../../../components/controls/Button/Button";
import { ButtonRow } from "../../../components/controls/ButtonRow/ButtonRow";
import { CornerFrame } from "../../../components/layout/CornerFrame/CornerFrame";
import { RecIndicator } from "../../../components/text/RecIndicator/RecIndicator";
import { Scanlines } from "../../../components/effects/Scanlines/Scanlines";
import { Screen } from "../../../components/layout/Screen/Screen";
import { Vignette } from "../../../components/effects/Vignette/Vignette";
import { useStoryKeys } from "./useStoryKeys";
import styles from "./StoryPanels.module.css";

export interface StoryPanelsProps {
  panels: readonly StoryPanel[];
  /** Libellé du bouton d'avance sur le dernier panneau. */
  doneLabel: string;
  onDone: () => void;
}

// Visionneuse de panneaux illustrés : un panneau à la fois, qu'on avance ou
// qu'on passe. Elle ne lit pas le store et ne connaît pas le flux d'écran.
// see: docs/4-technique/interface-react.md#panneaux-dhistoire
export function StoryPanels({ panels, doneLabel, onDone }: StoryPanelsProps) {
  const [index, setIndex] = useState(0);
  const panel = panels[index];
  const last = index >= panels.length - 1;

  function handleNext() {
    if (last) onDone();
    else setIndex(index + 1);
  }

  useStoryKeys(handleNext, onDone);
  if (!panel) return null;

  return (
    <Screen>
      <Scanlines />
      <Vignette />
      <RecIndicator placement="corner">ARCHIVE · RÉVEIL_DU_PEUPLE</RecIndicator>

      <CornerFrame className={styles.stage}>
        <figure key={panel.id} className={styles.picture}>
          {panel.image !== null ? (
            <img className={styles.image} src={assetUrl(panel.image)} alt={panel.alt} />
          ) : (
            <div className={styles.placeholder} role="img" aria-label={panel.alt}>
              <span className={styles.placeholderNumber}>{String(index + 1).padStart(2, "0")}</span>
              <span>IMAGE À VENIR</span>
            </div>
          )}
          <figcaption className={styles.caption} aria-live="polite">
            {panel.caption.map((line) => (
              <p key={line} className={styles.line}>
                {line}
              </p>
            ))}
          </figcaption>
        </figure>
      </CornerFrame>

      <div className={styles.footer}>
        <span className={styles.progress}>{`PLAN ${index + 1} / ${panels.length}`}</span>
        <ButtonRow>
          <Button className={styles.action} variant="primary" onClick={handleNext}>
            {last ? `▶ ${doneLabel}` : "▶ SUITE"}
          </Button>
          {!last && (
            <Button className={styles.action} onClick={onDone}>
              ▶▶ PASSER
            </Button>
          )}
        </ButtonRow>
        <span className={styles.hint}>ESPACE : suite · ÉCHAP : passer</span>
      </div>
    </Screen>
  );
}
