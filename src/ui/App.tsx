import { DebugPanel } from "./DebugPanel";
import { DeathScreen } from "./DeathScreen";
import { HeroLine } from "./HeroLine";
import { Hud } from "./Hud";
import { HudMessage } from "./HudMessage";
import { LevelCompleteScreen } from "./LevelCompleteScreen";
import { TuningPanel } from "./TuningPanel";

/**
 * Racine React montée UNE FOIS le niveau choisi (voir `main.ts::resolveBootChoice`
 * puis `root.render(createElement(App))`) — jamais avant, `MainMenu`/
 * `LevelMenu`/`RebindScreen` sont rendus directement dans `root` en amont,
 * hors de cet arbre.
 *
 * `Hud`/`HeroLine` (Phase 6, HUD de prod) cohabitent avec `DebugPanel`
 * (outil de DEV, jamais transformé en HUD de prod — voir sa doc de tête) et
 * `HudMessage` (canal système, distinct du canal `HeroLine`, voir
 * `game/state.ts`). `DeathScreen`/`LevelCompleteScreen` restent montés en
 * permanence mais rendent `null` tant que leur condition n'est pas remplie
 * (même pattern que `HudMessage`) — pas de montage/démontage conditionnel
 * ici, plus simple et sans risque de rater un changement d'état pendant que
 * le composant serait démonté.
 */
export function App() {
  return (
    <>
      <DebugPanel />
      <TuningPanel />
      <Hud />
      <HeroLine />
      <HudMessage />
      <DeathScreen />
      <LevelCompleteScreen />
    </>
  );
}
