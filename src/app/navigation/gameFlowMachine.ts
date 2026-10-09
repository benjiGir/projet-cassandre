import { type Actor, createActor, setup } from "xstate";

import type { GameFlowEvent, GameFlowState } from "./gameFlowTypes";

// see: docs/decisions/0019-machine-xstate-flux-ecran.md

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
        BEGIN_LOAD: "loading",
      },
    },
    mainMenu: {
      on: {
        BEGIN_LOAD: "loading",
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
        BEGIN_LOAD: "loading",
      },
    },
    loading: {
      on: {
        SHOW_INTRO: "intro",
        PLAY: "playing",
        LOAD_FAILED: "loadFailed",
        RETURN_TO_MENU: "mainMenu",
      },
    },
    loadFailed: {
      on: {
        RETRY_LOAD: "loading",
        RETURN_TO_MENU: "mainMenu",
      },
    },
    // see: docs/4-technique/interface-react.md#panneaux-dhistoire
    intro: {
      on: {
        PLAY: "playing",
      },
    },
    playing: {
      on: {
        DIED: "dead",
        SHOW_OUTRO: "outro",
        LEVEL_COMPLETED: "levelComplete",
        PAUSE: "paused",
      },
    },
    outro: {
      on: {
        LEVEL_COMPLETED: "levelComplete",
      },
    },
    // see: docs/archive/systems-session.md#pause
    paused: {
      on: {
        RESUME: "playing",
        RETURN_TO_MENU: "mainMenu",
      },
    },
    dead: {
      on: {
        REPLAY: "loading",
        RETURN_TO_MENU: "mainMenu",
      },
    },
    levelComplete: {
      on: {
        NEXT_LEVEL: "loading",
        REPLAY: "loading",
        RETURN_TO_MENU: "mainMenu",
      },
    },
  },
} satisfies { id: string; initial: GameFlowState; states: Record<GameFlowState, unknown> });

export type GameFlowActor = Actor<typeof gameFlowMachine>;

/** Le pas fixe n'exécute son contenu que dans cet état : les panneaux d'histoire ne comptent pas dans le chronomètre. */
export function isPlayingState(state: GameFlowState): boolean {
  return state === "playing";
}

/** Le monde physique existe et continue de tourner derrière l'écran affiché. */
export function isPhysicsLiveState(state: GameFlowState): boolean {
  return state === "playing" || state === "paused" || state === "dead" || state === "outro" || state === "levelComplete";
}

export function createGameFlowActor(): GameFlowActor {
  return createActor(gameFlowMachine).start();
}
