import { createElement } from "react";
import type { createRoot } from "react-dom/client";

import { LEVEL_CHOICES, type LevelDef } from "../../game/level/catalog/levels";
import { LevelMenu } from "../../ui/dev/LevelMenu/LevelMenu";
import { ZoneChooserLink } from "../../ui/dev/ZoneChooserLink/ZoneChooserLink";
import { MainMenu } from "../../ui/screens/mainMenu/MainMenu/MainMenu";
import { OptionsScreen } from "../../ui/screens/options/OptionsScreen/OptionsScreen";

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

export function resolveBootChoice(root: ReturnType<typeof createRoot>): Promise<LevelDef> {
  const levelParam = new URLSearchParams(window.location.search).get("level");
  if (levelParam) return resolveLevelChoice(root);

  return new Promise((resolve) => {
    function showMainMenu() {
      root.render(
        createElement(MainMenu, {
          onPlay: () => resolve(MAIN_LEVEL),
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
    showMainMenu();
  });
}
