import { useState } from "react";

import { input } from "../../../../../core/input";
import { ACTION_LABELS, ALL_ACTIONS, DEFAULT_BINDINGS, formatKeyCode } from "../../../../../core/inputBindings";
import type { GameAction } from "../../../../../core/inputTypes";
import { Button } from "../../../../components/controls/Button/Button";
import { ButtonRow } from "../../../../components/controls/ButtonRow/ButtonRow";
import { KeyBinding } from "../KeyBinding/KeyBinding";
import { OptionSection } from "../../fields/OptionSection/OptionSection";
import { useInputCapture } from "./useInputCapture";
import styles from "./ControlsTab.module.css";

// see: docs/6-reference/controles.md
export function ControlsTab() {
  const [bindings, setBindings] = useState(() => input.getAllBindings());
  const [listeningFor, setListeningFor] = useState<GameAction | null>(null);

  useInputCapture(listeningFor !== null, {
    onCapture(code) {
      if (!listeningFor) return;
      input.rebind(listeningFor, code);
      setBindings(input.getAllBindings());
      setListeningFor(null);
    },
    onCancel() {
      setListeningFor(null);
    },
  });

  function handleReset() {
    input.resetBindings();
    setBindings(input.getAllBindings());
    setListeningFor(null);
  }

  return (
    <>
      <OptionSection
        title="CANAUX D'ENTRÉE"
        hint="AZERTY (ZQSD) fonctionne déjà par défaut — ceci remappe au-delà. Échap annule une capture."
      >
        <div className={styles.grid}>
          {ALL_ACTIONS.map((action) => (
            <KeyBinding
              key={action}
              label={ACTION_LABELS[action]}
              keyLabel={formatKeyCode(bindings[action])}
              listening={listeningFor === action}
              modified={bindings[action] !== DEFAULT_BINDINGS[action]}
              onRequestCapture={() => setListeningFor(action)}
            />
          ))}
        </div>
      </OptionSection>

      <ButtonRow className={styles.reset}>
        <Button onClick={handleReset}>↺ RÉINITIALISER LES TOUCHES</Button>
      </ButtonRow>
    </>
  );
}
