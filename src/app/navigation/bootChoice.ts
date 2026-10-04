import { createElement } from "react";
import type { createRoot } from "react-dom/client";

import { LEVEL_CHOICES, type LevelDef } from "../../game/level/catalog/levels";
import { levelStory } from "../../game/session/presentation/storyPanels";
import { DIFFICULTIES, DIFFICULTY_INFO, difficultyConfig, difficultyEffects } from "../../game/session/progression/difficulty";
import { getDifficulty, setDifficulty } from "../../game/settings/difficultySettings";
import { recordFor } from "../../game/settings/records";
import { hasSeenIntro } from "../../game/settings/storySettings";
import { LevelMenu } from "../../ui/dev/LevelMenu/LevelMenu";
import { ZoneChooserLink } from "../../ui/dev/ZoneChooserLink/ZoneChooserLink";
import { DifficultyScreen, type DifficultyOption } from "../../ui/screens/difficulty/DifficultyScreen/DifficultyScreen";
import { MainMenu } from "../../ui/screens/mainMenu/MainMenu/MainMenu";
import { OptionsScreen } from "../../ui/screens/options/OptionsScreen/OptionsScreen";
import { StoryPanels } from "../../ui/screens/story/StoryPanels/StoryPanels";

// see: docs/6-reference/notes-code-core.md#chargement-et-orchestration

const MAIN_LEVEL = LEVEL_CHOICES.find((entry) => entry.id === "niveau_v2") ?? LEVEL_CHOICES[0];

/** Les trois difficultés telles que l'écran de choix les montre, avec le record de `levelId` dans chacune. */
export function difficultyOptions(levelId: string): DifficultyOption[] {
  return DIFFICULTIES.map((id) => ({
    id,
    ...DIFFICULTY_INFO[id],
    effects: difficultyEffects(difficultyConfig[id]),
    record: recordFor(levelId, id),
  }));
}

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

export function resolveBootChoice(root: ReturnType<typeof createRoot>): Promise<LevelDef> {
  const levelParam = new URLSearchParams(window.location.search).get("level");
  if (levelParam) return resolveLevelChoice(root);

  return new Promise((resolve) => {
    function showMainMenu() {
      const intro = hasSeenIntro(MAIN_LEVEL.id) ? levelStory(MAIN_LEVEL.id)?.intro : undefined;
      root.render(
        createElement(MainMenu, {
          onPlay: showDifficulty,
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
                  chooseZone(root).then(resolve);
                },
              })
            : undefined,
        }),
      );
    }
    // La difficulté se choisit au lancement, et se garde avec les réglages.
    // `?level=` et le choix de zone du dev passent outre : ils gardent la dernière choisie.
    function showDifficulty() {
      root.render(
        createElement(DifficultyScreen, {
          options: difficultyOptions(MAIN_LEVEL.id),
          selected: getDifficulty(),
          onChoose: (difficulty) => {
            setDifficulty(difficulty);
            resolve(MAIN_LEVEL);
          },
          onBack: showMainMenu,
        }),
      );
    }
    showMainMenu();
  });
}
