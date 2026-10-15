import { useRef, type ReactNode } from "react";

import type { OptionsTab } from "../OptionsTabs/OptionsTabs";
import { useScrollEdges } from "./useScrollEdges";
import styles from "./TabBody.module.css";

export interface TabBodyProps {
  tab: OptionsTab;
  children: ReactNode;
}

// Le contenu d'un onglet. C'est lui qui défile quand l'onglet est plus haut
// que la fenêtre, pas l'écran : le titre et « Retour » restent en vue. Monté
// avec une `key` par onglet, pour repartir du haut à chaque changement.
// see: docs/archive/systems-hud.md#options-contrôles-et-affichage
export function TabBody({ tab, children }: TabBodyProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const edges = useScrollEdges(scroller);

  return (
    <div className={styles.body} data-above={edges.above}>
      <div
        ref={scroller}
        id={`options-panel-${tab}`}
        className={styles.scroller}
        role="tabpanel"
        aria-labelledby={`options-tab-${tab}`}
        tabIndex={0}
      >
        {children}
      </div>
      <div className={styles.more} data-visible={edges.below} aria-hidden="true">
        ▼ SUITE
      </div>
    </div>
  );
}
