import type { Root } from "react-dom/client";

import { beginLoading, waitForLoadingRetry } from "../../../core/loading/loadingProgress";
import { useGameStore } from "../../../game/hud/state";
import { HeroPortrait } from "../../../game/session/presentation/heroPortrait";
import type { HeroPortraitReaction } from "../../../game/hud/hudTypes";
import { Hud } from "../../hud/Hud/Hud";
import { HudMessage } from "../../hud/overlays/HudMessage/HudMessage";
import { PerkOffer } from "../../hud/overlays/PerkOffer/PerkOffer";
import { DeathScreen } from "../../screens/death/DeathScreen/DeathScreen";
import { DifficultyScreen } from "../../screens/difficulty/DifficultyScreen/DifficultyScreen";
import { LevelCompleteScreen } from "../../screens/levelComplete/LevelCompleteScreen/LevelCompleteScreen";
import { LoadingScreen } from "../../screens/loading/LoadingScreen/LoadingScreen";
import { MainMenu } from "../../screens/mainMenu/MainMenu/MainMenu";
import { OptionsScreen } from "../../screens/options/OptionsScreen/OptionsScreen";
import { StoryPanels } from "../../screens/story/StoryPanels/StoryPanels";
import { levelStory } from "../../../game/session/presentation/storyPanels";
import { difficultyOptions } from "../../../game/session/presentation/difficultyOptions";
import { DebugPanel } from "../DebugPanel/DebugPanel";
import { TuningPanel } from "../tuning/TuningPanel/TuningPanel";
import { ZoneChooserLink } from "../ZoneChooserLink/ZoneChooserLink";
import styles from "./devPreview.module.css";

// see: docs/4-technique/interface-react.md

const PREVIEW_SCREENS = [
  "mainMenu",
  "options",
  "difficulty",
  "death",
  "levelComplete",
  "storyIntro",
  "storyOutro",
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
    followers: 2305,
    wallet: 86,
  });
  state.setChat([
    { id: 1, pseudo: "xX_Sceptik_Xx", text: "fake", kind: "message" },
    { id: 2, pseudo: "JeanMi_du_38", text: "regardez sa nuque au ralenti !! des écailles !!", kind: "message" },
    { id: 3, pseudo: "caddie_fou", text: "a donné 5 €", kind: "don" },
    { id: 4, pseudo: "definitivement_humain", text: "ce magasin est très bien noté par ses clients", kind: "message" },
    { id: 5, pseudo: "pixel_baveux", text: "c'est quel jeu ?", kind: "message" },
  ]);
  state.showDonation({ pseudo: "premier_abonne", amount: 50, text: "J'ai vu sa voiture sur la caméra 4. Il est donc là-haut.", mystery: true });
  state.setCards(["argent", "or"]);
  state.setPerkOffer({ key: "E", label: "Gilet Alu-Tactique", effect: "PV maximum augmentés", price: 100, sold: false });
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
    case "difficulty":
      root.render(
        <DifficultyScreen
          options={difficultyOptions("niveau_v2").map((option) =>
            option.id === "habitue" ? { ...option, record: { score: 12400, seconds: 572 } } : option,
          )}
          selected="habitue"
          onChoose={noop}
          onBack={noop}
        />,
      );
      break;
    case "death":
      useGameStore.setState({ flowState: "dead" });
      useGameStore.getState().setDebug({ views: 48213 });
      root.render(<DeathScreen onReplay={noop} onReturnToMenu={noop} />);
      break;
    case "levelComplete":
      useGameStore.setState({ flowState: "levelComplete" });
      useGameStore.getState().setDebug({ views: 612044 });
      useGameStore.getState().setLiveRecap({ peakViewers: 612044, followers: 15501, followersGained: 15301, donations: 262, donationCount: 19 });
      useGameStore.getState().setSecretsTotal(2);
      useGameStore.getState().incrementSecretsFound();
      root.render(<LevelCompleteScreen onReplay={noop} onReturnToMenu={noop} />);
      break;
    case "storyIntro":
      root.render(<StoryPanels panels={levelStory("niveau_v2")?.intro ?? []} doneLabel="LANCER LE DIRECT" onDone={noop} />);
      break;
    case "storyOutro":
      root.render(<StoryPanels panels={levelStory("niveau_v2")?.outro ?? []} doneLabel="VOIR LE BILAN" onDone={noop} />);
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
          <PerkOffer />
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
