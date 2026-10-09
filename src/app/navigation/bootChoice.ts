import { createElement } from "react";
import type { createRoot } from "react-dom/client";

import { LEVEL_CHOICES, type LevelDef } from "../../game/level/catalog/levels";
import { levelStory } from "../../game/session/presentation/storyPanels";
import { difficultyOptions } from "../../game/session/presentation/difficultyOptions";
import { getDifficulty, setDifficulty } from "../../game/settings/difficultySettings";
import { hasSeenIntro } from "../../game/settings/storySettings";
import { LevelMenu } from "../../ui/dev/LevelMenu/LevelMenu";
import { ZoneChooserLink } from "../../ui/dev/ZoneChooserLink/ZoneChooserLink";
import { DifficultyScreen } from "../../ui/screens/difficulty/DifficultyScreen/DifficultyScreen";
import { MainMenu } from "../../ui/screens/mainMenu/MainMenu/MainMenu";
import { OptionsScreen } from "../../ui/screens/options/OptionsScreen/OptionsScreen";
import { StoryPanels } from "../../ui/screens/story/StoryPanels/StoryPanels";
import { LevelSelectScreen } from "../../ui/screens/levelSelect/LevelSelectScreen/LevelSelectScreen";
import { campaignArrival } from "../../game/session/campaign/campaignStorage";
import { metroLevel, METRO_LEVEL_ID } from "../../game/session/campaign/campaignCatalog";
import type { SessionEntry } from "../../game/session/campaign/campaignTypes";
import { metroArrival } from "../../game/session/campaign/campaignArrival";

export interface SessionStart {
  readonly choice: LevelDef;
  readonly entry: SessionEntry;
}

// see: docs/6-reference/notes-code-core.md#chargement-et-orchestration

const MAIN_LEVEL = LEVEL_CHOICES.find((entry) => entry.id === "niveau_v2") ?? LEVEL_CHOICES[0];

function chooseZone(root: ReturnType<typeof createRoot>): Promise<LevelDef> {
  return new Promise((resolve) => {
    root.render(
      createElement(LevelMenu, {
        options: LEVEL_CHOICES.map((entry) => ({ id: entry.id, label: entry.label })),
        onChoose: (id) => {
          const chosen = LEVEL_CHOICES.find((entry) => entry.id === id);
          resolve(chosen ?? LEVEL_CHOICES[0]);
        },
      }),
    );
  });
}

export function resolveLevelChoice(root: ReturnType<typeof createRoot>): Promise<LevelDef> {
  const levelParam = new URLSearchParams(window.location.search).get("level");
  if (levelParam) {
    const registered = LEVEL_CHOICES.find((entry) => entry.id === levelParam);
    if (registered) return Promise.resolve(registered);
    return Promise.resolve({
      id: levelParam,
      label: levelParam,
      kind: "gltf",
      gltfName: levelParam,
    });
  }
  return import.meta.env.DEV ? chooseZone(root) : Promise.resolve(MAIN_LEVEL);
}

export function resolveBootChoice(root: ReturnType<typeof createRoot>): Promise<SessionStart> {
  const levelParam = new URLSearchParams(window.location.search).get("level");
  if (levelParam) return resolveLevelChoice(root).then((choice) => {
    const profile = new URLSearchParams(window.location.search).get("campaignProfile");
    const arrival = import.meta.env.DEV && (profile === "type" || profile === "pauvre" || profile === "riche")
      ? metroArrival(getDifficulty(), profile) : undefined;
    return { choice, entry: { mode: "dev", arrival } };
  });

  return new Promise((resolve) => {
    function showMainMenu() {
      const arrival = campaignArrival();
      const intro = hasSeenIntro(MAIN_LEVEL.id) ? levelStory(MAIN_LEVEL.id)?.intro : undefined;
      root.render(
        createElement(MainMenu, {
          onPlay: () => showDifficulty(MAIN_LEVEL, "new-game"),
          onContinue: arrival ? () => resolve({ choice: metroLevel(), entry: { mode: "continue", arrival } }) : undefined,
          onChooseLevel: showLevels,
          onReplayIntro: intro
            ? () => {
                root.render(createElement(StoryPanels, { panels: intro, doneLabel: "RETOUR AU MENU", onDone: showMainMenu }));
              }
            : undefined,
          onOptions: () => {
            root.render(createElement(OptionsScreen, { onBack: showMainMenu }));
          },
          devTools: import.meta.env.DEV
            ? createElement(ZoneChooserLink, {
                onClick: () => {
                  chooseZone(root).then((choice) => resolve({ choice, entry: { mode: "dev" } }));
                },
              })
            : undefined,
        }),
      );
    }
    function showLevels() {
      const unlocked = campaignArrival() !== null;
      root.render(createElement(LevelSelectScreen, {
        options: [
          { id: MAIN_LEVEL.id, label: "Hyper Varan", description: "Le premier direct. Départ sans arme ni amélioration.", locked: false },
          { id: METRO_LEVEL_ID, label: "Le métro — pilote", description: unlocked
            ? "Quai et trains en chantier. Équipement type, trois armes et 40 €."
            : "Terminez Hyper Varan pour débloquer ce direct.", locked: !unlocked },
        ],
        onChoose: (id) => {
          if (id === MAIN_LEVEL.id) showDifficulty(MAIN_LEVEL, "standalone");
          else if (id === METRO_LEVEL_ID && unlocked) showDifficulty(metroLevel(), "standalone");
        },
        onBack: showMainMenu,
      }));
    }

    function showDifficulty(choice: LevelDef, mode: "new-game" | "standalone") {
      root.render(
        createElement(DifficultyScreen, {
          options: difficultyOptions(choice.id),
          title: choice.id === METRO_LEVEL_ID ? "QUI DESCEND DANS LE MÉTRO ?" : undefined,
          selected: getDifficulty(),
          onChoose: (difficulty) => {
            setDifficulty(difficulty);
            resolve({ choice, entry: { mode } });
          },
          onBack: showMainMenu,
        }),
      );
    }
    showMainMenu();
  });
}
