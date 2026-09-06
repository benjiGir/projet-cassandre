import { type Actor, createActor, setup } from "xstate";

import type { GameFlowState } from "../game/state";

/**
 * Machine de flux d'écran — graphe d'état PUR, testable sans DOM/Three.js/
 * Rapier (voir `test/ui/gameFlowMachine.test.ts`). Ne connaît rien du jeu :
 * ni `PhysicsWorld`, ni `scene`, ni `bootGameSession`/`teardownGameSession`.
 * Le câblage runtime réel est volontairement plus grossier que la table de
 * transition testée ci-dessous (les états `options`/`levelSelect` ne sont
 * jamais atteints par l'acteur réel de l'application).
 * see: docs/decisions/0019-machine-xstate-flux-ecran.md
 * see: docs/systems/hud.md#flux-décran
 */

export type GameFlowEvent =
  | { type: "ENTER_MENU" }
  | { type: "OPEN_OPTIONS" }
  | { type: "BACK_TO_MENU" }
  | { type: "CHOOSE_ZONE" }
  | { type: "PLAY" }
  | { type: "DIED" }
  | { type: "LEVEL_COMPLETED" }
  | { type: "REPLAY" }
  | { type: "RETURN_TO_MENU" };

export const gameFlowMachine = setup({
  types: {} as {
    events: GameFlowEvent;
  },
}).createMachine({
  id: "gameFlow",
  initial: "boot",
  states: {
    boot: {
      on: {
        ENTER_MENU: "mainMenu",
        PLAY: "playing",
      },
    },
    mainMenu: {
      on: {
        PLAY: "playing",
        OPEN_OPTIONS: "options",
        CHOOSE_ZONE: "levelSelect",
      },
    },
    options: {
      on: {
        BACK_TO_MENU: "mainMenu",
      },
    },
    levelSelect: {
      on: {
        PLAY: "playing",
      },
    },
    playing: {
      on: {
        DIED: "dead",
        LEVEL_COMPLETED: "levelComplete",
      },
    },
    dead: {
      on: {
        REPLAY: "playing",
        RETURN_TO_MENU: "mainMenu",
      },
    },
    levelComplete: {
      on: {
        REPLAY: "playing",
        RETURN_TO_MENU: "mainMenu",
      },
    },
  },
} satisfies { id: string; initial: GameFlowState; states: Record<GameFlowState, unknown> });

export type GameFlowActor = Actor<typeof gameFlowMachine>;

/**
 * Un seul acteur pour toute la durée de vie de l'onglet — créé une fois dans
 * `main.ts`, jamais recréé par un reset.
 * see: docs/decisions/0019-machine-xstate-flux-ecran.md
 */
export function createGameFlowActor(): GameFlowActor {
  return createActor(gameFlowMachine).start();
}
