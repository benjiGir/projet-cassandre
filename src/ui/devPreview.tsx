import { createElement } from "react";
import type { createRoot } from "react-dom/client";

import { useGameStore } from "../game/state";
import { reportLoading } from "../core/loadingProgress";
import { DeathScreen } from "./DeathScreen";
import { HeroLine } from "./HeroLine";
import { Hud } from "./Hud";
import { HudMessage } from "./HudMessage";
import { LevelCompleteScreen } from "./LevelCompleteScreen";
import { LoadingScreen } from "./LoadingScreen";
import { MainMenu } from "./MainMenu";
import { RebindScreen } from "./RebindScreen";

/**
 * Harnais d'aperçu, DEV UNIQUEMENT — monte un écran donné avec un état
 * factice, sans passer par `bootGameSession`/la boucle de jeu. Existe parce
 * que `DeathScreen`/`LevelCompleteScreen` sont difficiles à atteindre en
 * jouant (il faut mourir, ou traverser tout le niveau) et que
 * l'automatisation navigateur n'obtient pas le pointer lock : sans ce
 * harnais, six écrans × trois variantes ne peuvent pas être capturés à
 * l'écran pour de vrai.
 *
 * Activé par `?uiPreview=<écran>`, appelé depuis `main.ts` AVANT tout le reste, gardé par
 * `import.meta.env.DEV` des deux côtés — même régime que `DebugPanel`/
 * `TuningPanel`/`exposeDebugApi` (commit b294ad7) : la branche entière
 * disparaît du bundle de production, ce fichier n'y est jamais importé.
 *
 * see: docs/systems/hud.md
 */

const PREVIEW_SCREENS = ["mainMenu", "options", "death", "levelComplete", "loading", "hud"] as const;
type PreviewScreen = (typeof PREVIEW_SCREENS)[number];

function isPreviewScreen(value: string): value is PreviewScreen {
  return (PREVIEW_SCREENS as readonly string[]).includes(value);
}

const noop = () => {};

/**
 * Fond neutre derrière le HUD pour l'aperçu : en jeu le HUD est un calque
 * transparent au-dessus du canvas 3D (`pointerEvents: "none"`), qui n'existe
 * pas ici. Un aplat sombre suffit à juger la lisibilité du calque — jamais
 * monté en dehors de ce harnais.
 */
function HudBackdrop() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "linear-gradient(160deg, #2a2a26 0%, #17170f 55%, #0c0c08 100%)",
      }}
    />
  );
}

/**
 * Retourne `true` si `?uiPreview=` a été reconnu et un rendu produit — dans
 * ce cas l'appelant (`main.ts`) doit s'arrêter là, ne JAMAIS démarrer le
 * reste du boot (physique, session, boucle). Retourne `false` sinon, pour
 * laisser le boot normal continuer.
 */
export function maybeRenderDevPreview(root: ReturnType<typeof createRoot>): boolean {
  const raw = new URLSearchParams(window.location.search).get("uiPreview");
  if (!raw || !isPreviewScreen(raw)) return false;

  switch (raw) {
    case "mainMenu": {
      root.render(createElement(MainMenu, { onPlay: noop, onOptions: noop, onChooseZone: noop }));
      break;
    }
    case "options": {
      root.render(createElement(RebindScreen, { onBack: noop }));
      break;
    }
    case "death": {
      useGameStore.setState({ flowState: "dead" });
      useGameStore.getState().setDebug({ views: 48213 });
      root.render(createElement(DeathScreen, { onReplay: noop, onReturnToMenu: noop }));
      break;
    }
    case "levelComplete": {
      useGameStore.setState({ flowState: "levelComplete" });
      useGameStore.getState().setDebug({ views: 612044 });
      useGameStore.getState().setSecretsTotal(2);
      useGameStore.getState().incrementSecretsFound();
      root.render(createElement(LevelCompleteScreen, { onReplay: noop, onReturnToMenu: noop }));
      break;
    }
    case "loading": {
      reportLoading("Chargement du niveau", 0.47);
      root.render(createElement(LoadingScreen));
      break;
    }
    case "hud": {
      const state = useGameStore.getState();
      state.setDebug({
        playerHp: 62,
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
      root.render(
        createElement(
          "div",
          null,
          createElement(HudBackdrop),
          createElement(Hud),
          createElement(HeroLine),
          createElement(HudMessage),
        ),
      );
      break;
    }
  }
  return true;
}
