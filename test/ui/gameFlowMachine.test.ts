/**
 * Jalon M8 (PLAN_EFFECT_XSTATE.md, §10) — table de transitions complète de
 * `gameFlowMachine` (`src/ui/gameFlowMachine.ts`), testée EN ISOLATION :
 * aucun DOM, aucun Three.js, aucun Rapier — l'acteur XState est une machine
 * pure (voir la doc de tête du fichier source pour la distinction entre
 * cette table COMPLÈTE et le câblage runtime plus grossier de `main.ts`).
 */
import { describe, expect, it } from "vitest";

import { createGameFlowActor } from "../../src/ui/gameFlowMachine";

describe("gameFlowMachine", () => {
  it("démarre sur boot", () => {
    const actor = createGameFlowActor();
    expect(actor.getSnapshot().value).toBe("boot");
  });

  it("boot -> mainMenu via ENTER_MENU", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "ENTER_MENU" });
    expect(actor.getSnapshot().value).toBe("mainMenu");
  });

  it("boot -> playing via PLAY (bypass ?level=, sans passer par le menu)", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "PLAY" });
    expect(actor.getSnapshot().value).toBe("playing");
  });

  it("mainMenu -> playing via PLAY", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "ENTER_MENU" });
    actor.send({ type: "PLAY" });
    expect(actor.getSnapshot().value).toBe("playing");
  });

  it("mainMenu -> options via OPEN_OPTIONS, puis options -> mainMenu via BACK_TO_MENU", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "ENTER_MENU" });
    actor.send({ type: "OPEN_OPTIONS" });
    expect(actor.getSnapshot().value).toBe("options");
    actor.send({ type: "BACK_TO_MENU" });
    expect(actor.getSnapshot().value).toBe("mainMenu");
  });

  it("mainMenu -> levelSelect via CHOOSE_ZONE, puis levelSelect -> playing via PLAY", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "ENTER_MENU" });
    actor.send({ type: "CHOOSE_ZONE" });
    expect(actor.getSnapshot().value).toBe("levelSelect");
    actor.send({ type: "PLAY" });
    expect(actor.getSnapshot().value).toBe("playing");
  });

  it("playing -> dead via DIED", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "PLAY" });
    actor.send({ type: "DIED" });
    expect(actor.getSnapshot().value).toBe("dead");
  });

  it("playing -> levelComplete via LEVEL_COMPLETED", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "PLAY" });
    actor.send({ type: "LEVEL_COMPLETED" });
    expect(actor.getSnapshot().value).toBe("levelComplete");
  });

  it("dead -> playing via REPLAY (rejouer)", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "PLAY" });
    actor.send({ type: "DIED" });
    actor.send({ type: "REPLAY" });
    expect(actor.getSnapshot().value).toBe("playing");
  });

  it("dead -> mainMenu via RETURN_TO_MENU", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "PLAY" });
    actor.send({ type: "DIED" });
    actor.send({ type: "RETURN_TO_MENU" });
    expect(actor.getSnapshot().value).toBe("mainMenu");
  });

  it("levelComplete -> playing via REPLAY (rejouer le même niveau)", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "PLAY" });
    actor.send({ type: "LEVEL_COMPLETED" });
    actor.send({ type: "REPLAY" });
    expect(actor.getSnapshot().value).toBe("playing");
  });

  it("levelComplete -> mainMenu via RETURN_TO_MENU", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "PLAY" });
    actor.send({ type: "LEVEL_COMPLETED" });
    actor.send({ type: "RETURN_TO_MENU" });
    expect(actor.getSnapshot().value).toBe("mainMenu");
  });

  it("scénario complet : boot -> menu -> jeu -> mort -> rejouer -> jeu", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "ENTER_MENU" });
    actor.send({ type: "PLAY" });
    actor.send({ type: "DIED" });
    actor.send({ type: "REPLAY" });
    expect(actor.getSnapshot().value).toBe("playing");
  });

  it("scénario complet : boot -> menu -> jeu -> fin de niveau -> retour au menu", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "ENTER_MENU" });
    actor.send({ type: "PLAY" });
    actor.send({ type: "LEVEL_COMPLETED" });
    actor.send({ type: "RETURN_TO_MENU" });
    expect(actor.getSnapshot().value).toBe("mainMenu");
  });

  it("un évènement non déclaré pour l'état courant est un no-op (ex. DIED en dehors de playing)", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "ENTER_MENU" });
    actor.send({ type: "DIED" }); // pas de transition DIED déclarée depuis mainMenu
    expect(actor.getSnapshot().value).toBe("mainMenu");
  });
});
