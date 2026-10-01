import type { Root } from "react-dom/client";

import { beginLoading, waitForLoadingRetry } from "../../../core/loadingProgress";
import { useGameStore } from "../../../game/state";
import { HeroPortrait } from "../../../game/session/heroPortrait";
import type { HeroPortraitReaction } from "../../../game/state";
import { Hud } from "../../hud/Hud/Hud";
import { HudMessage } from "../../hud/overlays/HudMessage/HudMessage";
import { DeathScreen } from "../../screens/death/DeathScreen/DeathScreen";
import { LevelCompleteScreen } from "../../screens/levelComplete/LevelCompleteScreen/LevelCompleteScreen";
import { LoadingScreen } from "../../screens/loading/LoadingScreen/LoadingScreen";
import { MainMenu } from "../../screens/mainMenu/MainMenu/MainMenu";
import { OptionsScreen } from "../../screens/options/OptionsScreen/OptionsScreen";
import { DebugPanel } from "../DebugPanel/DebugPanel";
import { TuningPanel } from "../tuning/TuningPanel/TuningPanel";
import { ZoneChooserLink } from "../ZoneChooserLink/ZoneChooserLink";
import styles from "./devPreview.module.css";

/**
 * Harnais d'aperçu, DEV UNIQUEMENT : monte un écran avec un état factice,
 * sans physique, sans session, sans boucle. Il existe parce que la mort et
 * la fin de niveau sont longues à atteindre en jouant, et que
 * l'automatisation du navigateur n'obtient pas le verrouillage du pointeur.
 * Activé par `?uiPreview=<écran>` depuis `main.ts`, derrière une garde
 * `import.meta.env.DEV` : ce fichier n'entre jamais dans le bundle livré.
 * see: docs/4-technique/interface-react.md
 */

const PREVIEW_SCREENS = [
  "mainMenu",
  "options",
  "death",
  "levelComplete",
  "loading",
  "loadFailed",
  "hud",
  "debug",
  "tuning",
] as const;
type PreviewScreen = (typeof PREVIEW_SCREENS)[number];

function isPreviewScreen(value: string): value is PreviewScreen {
  return (PREVIEW_SCREENS as readonly string[]).includes(value);
}

function noop() {}

/** En jeu, le HUD est un calque transparent sur la scène 3D ; ici, un aplat sombre en tient lieu. */
function GameBackdrop() {
  return <div className={styles.backdrop} />;
}

function seedHudState() {
  const state = useGameStore.getState();
  const params = new URLSearchParams(window.location.search);
  const requestedHp = Number(params.get("portraitHp") ?? 62);
  const hp = Number.isFinite(requestedHp) ? Math.max(1, Math.min(100, requestedHp)) : 62;
  const requestedTime = Number(params.get("portraitTime") ?? 2);
  const time = Number.isFinite(requestedTime) ? Math.max(2, Math.min(20, requestedTime)) : 2;
  const portrait = new HeroPortrait();
  portrait.advance(1, hp, 100);
  portrait.advance(time - 1, hp, 100);
  const reactions: readonly HeroPortraitReaction[] = ["idle", "hurt", "focus", "victory", "discover", "talk", "heal"];
  const reaction = reactions.find((value) => value === params.get("portraitReaction")) ?? "talk";
  if (reaction === "talk") portrait.speak();
  else portrait.react(reaction);
  state.setHeroPortrait(portrait.view);
  state.setDebug({
    playerHp: hp,
    playerMaxHp: 100,
    shotgunAmmo: 4,
    shotgunMaxAmmo: 8,
    pistolAmmo: 11,
    pistolMaxAmmo: 15,
    activeWeapon: "shotgun",
    views: 84210,
  });
  state.setCards(["argent", "or"]);
  state.showHudMessage("Porte déverrouillée");
  state.showHeroLine("Ils ne veulent pas que vous voyiez ça. Moi je filme.");
}

/**
 * Rend l'écran demandé par `?uiPreview=` et retourne `true` : l'appelant doit
 * alors s'arrêter là, sans jamais démarrer le reste du boot.
 */
export function maybeRenderDevPreview(root: Root): boolean {
  const requested = new URLSearchParams(window.location.search).get("uiPreview");
  if (!requested || !isPreviewScreen(requested)) return false;

  switch (requested) {
    case "mainMenu":
      root.render(<MainMenu onPlay={noop} onOptions={noop} devTools={<ZoneChooserLink onClick={noop} />} />);
      break;
    case "options":
      root.render(<OptionsScreen onBack={noop} />);
      break;
    case "death":
      useGameStore.setState({ flowState: "dead" });
      useGameStore.getState().setDebug({ views: 48213 });
      root.render(<DeathScreen onReplay={noop} onReturnToMenu={noop} />);
      break;
    case "levelComplete":
      useGameStore.setState({ flowState: "levelComplete" });
      useGameStore.getState().setDebug({ views: 612044 });
      useGameStore.getState().setSecretsTotal(2);
      useGameStore.getState().incrementSecretsFound();
      root.render(<LevelCompleteScreen onReplay={noop} onReturnToMenu={noop} />);
      break;
    case "loading":
      beginLoading("Chargement du niveau", 0.47);
      root.render(<LoadingScreen />);
      break;
    case "loadFailed":
      beginLoading("Chargement du niveau", 0.47);
      void waitForLoadingRetry(new Error("Le fichier du niveau est absent ou invalide."));
      root.render(<LoadingScreen />);
      break;
    case "hud":
      seedHudState();
      root.render(
        <>
          <GameBackdrop />
          <Hud />
          <HudMessage />
        </>,
      );
      break;
    case "debug":
      seedHudState();
      root.render(
        <>
          <GameBackdrop />
          <DebugPanel />
        </>,
      );
      break;
    case "tuning":
      root.render(
        <>
          <GameBackdrop />
          <TuningPanel />
        </>,
      );
      break;
    default:
      return requested satisfies never;
  }
  return true;
}
