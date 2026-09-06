import { createElement } from "react";
import type { createRoot } from "react-dom/client";

import { LEVEL_CHOICES, type LevelDef } from "../level/levels";
import { LevelMenu } from "../../ui/LevelMenu";
import { MainMenu } from "../../ui/MainMenu";
import { RebindScreen } from "../../ui/RebindScreen";

// Ni l'une ni l'autre des deux fonctions ci-dessous n'envoie d'évènement à
// l'acteur de flux — voir `ui/gameFlowMachine.ts` et `main.ts` pour les
// évènements `ENTER_MENU`/`PLAY` qui encadrent ce sous-flux depuis l'appelant.

/**
 * Résout le `LevelDef` choisi pour ce boot, AVANT toute construction de
 * scène Three.js/monde Rapier. `?level=<nom>` non enregistré retombe sur
 * une fixture glTF brute — flexibilité délibérément préservée, ne pas la
 * retirer.
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

  const fullLevel = LEVEL_CHOICES.find((entry) => entry.id === "hypermarche_complet");
  // Filet de sécurité de TYPAGE uniquement, jamais atteint en pratique tant
  // que `levels.ts` garde cette entrée enregistrée — sans lui, "Jouer"
  // retomberait sur le tout premier choix du registre plutôt que de planter.
  const playChoice = fullLevel ?? LEVEL_CHOICES[0];

  return new Promise((resolve) => {
    function showMainMenu() {
      root.render(
        createElement(MainMenu, {
          onPlay: () => resolve(playChoice),
          onOptions: () => {
            root.render(createElement(RebindScreen, { onBack: showMainMenu }));
          },
          onChooseZone: () => {
            resolveLevelChoice(root).then(resolve);
          },
        }),
      );
    }
    showMainMenu();
  });
}
