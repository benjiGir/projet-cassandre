import { createElement } from "react";
import type { createRoot } from "react-dom/client";

import { LEVEL_CHOICES, type LevelDef } from "../level/levels";
import { LevelMenu } from "../../ui/dev/LevelMenu/LevelMenu";
import { ZoneChooserLink } from "../../ui/dev/ZoneChooserLink/ZoneChooserLink";
import { MainMenu } from "../../ui/screens/mainMenu/MainMenu/MainMenu";
import { OptionsScreen } from "../../ui/screens/options/OptionsScreen/OptionsScreen";

// Ni l'une ni l'autre des deux fonctions ci-dessous n'envoie d'évènement à
// l'acteur de flux — voir `ui/gameFlowMachine.ts` et `main.ts` pour les
// évènements `ENTER_MENU`/`PLAY` qui encadrent ce sous-flux depuis l'appelant.

// "Jouer" lance LE niveau du jeu, sans détour par un choix : le niveau v2
// habillé. `hypermarche_complet` (les cinq zones de la Phase 5 recollées)
// reste au registre et reste jouable par le choix de zone ou par `?level=`.
// Le repli sur la première entrée ne sert qu'au typage, tant que `levels.ts`
// garde `niveau_v2` enregistré.
const MAIN_LEVEL = LEVEL_CHOICES.find((entry) => entry.id === "niveau_v2") ?? LEVEL_CHOICES[0];

/**
 * Choix d'une zone à la main, OUTIL D'AUTEUR : il expose les zones de test et
 * les blockouts. N'est atteint que derrière `import.meta.env.DEV`, donc
 * `LevelMenu` quitte le bundle de production avec lui.
 */
function chooseZone(root: ReturnType<typeof createRoot>): Promise<LevelDef> {
  return new Promise((resolve) => {
    root.render(
      createElement(LevelMenu, {
        options: LEVEL_CHOICES.map((entry) => ({ id: entry.id, label: entry.label })),
        onChoose: (id) => {
          const chosen = LEVEL_CHOICES.find((entry) => entry.id === id);
          // `LevelMenu` n'appelle `onChoose` qu'avec un `id` qu'il a lui-même
          // reçu dans `options`, donc toujours résolvable ici — le fallback
          // ne sert qu'à satisfaire le type, jamais atteint en pratique.
          resolve(chosen ?? LEVEL_CHOICES[0]);
        },
      }),
    );
  });
}

/**
 * Résout le `LevelDef` choisi pour ce boot, AVANT toute construction de
 * scène Three.js/monde Rapier. `?level=<nom>` non enregistré retombe sur
 * une fixture glTF brute — flexibilité délibérément préservée, ne pas la
 * retirer. Sans `?level=`, c'est le choix de zone en dev, le niveau
 * principal en production.
 * see: docs/systems/session.md#choix-du-niveau-au-boot
 */
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

/**
 * Porte d'entrée du jeu. Enrobe `resolveLevelChoice` ci-dessus (INCHANGÉE)
 * d'un menu principal, SANS jamais l'afficher quand `?level=` est présent
 * dans l'URL : les deux chemins historiques par URL doivent continuer à
 * fonctionner exactement comme avant. Réutilisée par
 * `lifecycle.ts::returnToMenu` exactement comme au tout premier boot.
 * see: docs/systems/session.md#choix-du-niveau-au-boot
 */
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
          // `import.meta.env.DEV` est une constante au build : le lien de choix
          // de zone, et `chooseZone` avec lui, disparaissent du bundle de
          // production. `?level=` continue de marcher partout, c'est un
          // chemin d'outillage assumé.
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
