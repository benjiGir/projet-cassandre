import { DebugPanel } from "./DebugPanel";
import { DeathScreen } from "./DeathScreen";
import { FpsCounter } from "./FpsCounter";
import { HeroLine } from "./HeroLine";
import { Hud } from "./Hud";
import { HudMessage } from "./HudMessage";
import { LevelCompleteScreen } from "./LevelCompleteScreen";
import { TuningPanel } from "./TuningPanel";

/**
 * Racine React montée UNE FOIS le niveau choisi, jamais avant — `MainMenu`/
 * `LevelMenu`/`RebindScreen` sont rendus hors de cet arbre, en amont.
 * `onReplay`/`onReturnToMenu` sont de VRAIES fonctions de reset, pas des
 * rechargements de page ; `App` reste purement présentationnel côté
 * câblage, `main.ts` reste l'unique endroit qui sait QUOI faire quand ces
 * boutons sont cliqués.
 * see: docs/decisions/0019-machine-xstate-flux-ecran.md
 * see: docs/systems/hud.md#composition-de-app
 */
export interface AppProps {
  onReplay: () => void;
  onReturnToMenu: () => void;
}

export function App(props: AppProps) {
  const { onReplay, onReturnToMenu } = props;
  // `import.meta.env.DEV` est une constante au build : en production, les
  // deux panneaux de dev disparaissent du bundle, pas seulement de l'écran.
  return (
    <>
      {import.meta.env.DEV ? <DebugPanel /> : <FpsCounter />}
      {import.meta.env.DEV && <TuningPanel />}
      <Hud />
      <HeroLine />
      <HudMessage />
      <DeathScreen onReplay={onReplay} onReturnToMenu={onReturnToMenu} />
      <LevelCompleteScreen onReplay={onReplay} onReturnToMenu={onReturnToMenu} />
    </>
  );
}
