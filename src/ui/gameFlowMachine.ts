import { type Actor, createActor, setup } from "xstate";

import type { GameFlowState } from "../game/state";

/**
 * Jalon M8 (PLAN_EFFECT_XSTATE.md, §10) — machine de flux d'écran.
 * Remplace les `root.render()` de fin de partie pilotés par
 * `window.location.reload()`/`assign()` (`ui/screenNav.ts`, supprimé par ce
 * jalon) par un graphe d'état PUR, testable sans DOM/Three.js/Rapier (voir
 * `test/ui/gameFlowMachine.test.ts`).
 *
 * ## Ce que cette machine NE fait PAS
 *
 * Elle ne connaît RIEN du jeu : ni `PhysicsWorld`, ni `scene`, ni
 * `bootGameSession`/`teardownGameSession` (`main.ts`). Elle ne fait que
 * déclarer quels évènements mènent à quel état — exactement comme
 * `enemyMachine.ts` (M5) sépare le GRAPHE de la logique qui décide quand
 * l'envoyer. Le VRAI reset (dispose + reconstruction de `PhysicsWorld` etc.)
 * vit dans `main.ts`, déclenché par les mêmes boutons qui envoient `REPLAY`/
 * `RETURN_TO_MENU` à cet acteur — voir `main.ts::replay`/`returnToMenu`.
 *
 * ## Câblage RUNTIME volontairement plus grossier que la table de test
 *
 * La table de transition ci-dessous couvre les 7 états du plan à l'identique
 * (`boot`, `mainMenu`, `options`, `levelSelect`, `playing`, `dead`,
 * `levelComplete`) et EST intégralement testée en isolation (`REPLAY`,
 * `RETURN_TO_MENU`, `DIED`, `LEVEL_COMPLETED`, `OPEN_OPTIONS`, `BACK_TO_MENU`,
 * `CHOOSE_ZONE`, `PLAY` depuis chacun de ses états sources).
 *
 * Le câblage RÉEL dans `main.ts`, lui, est plus grossier PAR CHOIX explicite
 * (jugé "la partie la moins risquée de ce jalon" par la tâche) :
 * `resolveBootChoice`/`resolveLevelChoice` (`main.ts`, déjà en prod, non
 * touchés par ce jalon) gèrent EUX-MÊMES la navigation interne
 * MainMenu/RebindScreen/LevelMenu via leurs propres `root.render()`
 * impératifs, sans envoyer d'évènement à CET acteur à chaque clic interne.
 * `main.ts` n'envoie que DEUX évènements autour de tout ce sous-flux :
 * `ENTER_MENU` juste avant de l'afficher (si `?level=` absent) et `PLAY` une
 * fois qu'il résout (quel que soit le chemin interne emprunté — Jouer,
 * Options puis Retour puis Jouer, ou Choisir une zone). Conséquence honnête,
 * documentée ici plutôt que découverte en lisant `main.ts` : les états
 * `options`/`levelSelect` ne sont donc JAMAIS atteints par l'acteur réel de
 * l'application (rien ne lit `flowState === "options"` aujourd'hui — voir
 * `game/state.ts` — donc aucune régression fonctionnelle), seulement par les
 * tests qui les exercent directement via `actor.send(...)`.
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

/** Un seul acteur pour toute la durée de vie de l'onglet — créé une fois dans `main.ts`, jamais recréé par un reset (lui-même n'est PAS de l'état de partie, voir la doc de tête). */
export function createGameFlowActor(): GameFlowActor {
  return createActor(gameFlowMachine).start();
}
