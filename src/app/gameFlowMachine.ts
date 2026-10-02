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
    playing: {
      on: {
        DIED: "dead",
        LEVEL_COMPLETED: "levelComplete",
        PAUSE: "paused",
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
        REPLAY: "loading",
        RETURN_TO_MENU: "mainMenu",
      },
    },
  },
} satisfies { id: string; initial: GameFlowState; states: Record<GameFlowState, unknown> });

export type GameFlowActor = Actor<typeof gameFlowMachine>;

export function createGameFlowActor(): GameFlowActor {
  return createActor(gameFlowMachine).start();
}
