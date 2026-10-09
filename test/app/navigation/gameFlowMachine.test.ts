/**
 * Jalon M8 (PLAN_EFFECT_XSTATE.md, §10) — table de transitions complète de
 * `gameFlowMachine` (`src/app/navigation/gameFlowMachine.ts`), testée EN ISOLATION :
 * aucun DOM, aucun Three.js, aucun Rapier — l'acteur XState est une machine
 * pure (voir la doc de tête du fichier source pour la distinction entre
 * cette table COMPLÈTE et le câblage runtime plus grossier de `main.ts`).
 */
import { describe, expect, it } from "vitest";

import { createGameFlowActor, isPhysicsLiveState, isPlayingState } from "../../../src/app/navigation/gameFlowMachine";

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

  it("boot -> loading -> playing sans exposer le jeu avant PLAY", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "BEGIN_LOAD" });
    expect(actor.getSnapshot().value).toBe("loading");
    actor.send({ type: "PLAY" });
    expect(actor.getSnapshot().value).toBe("playing");
  });

  it("mainMenu -> loading -> playing", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "ENTER_MENU" });
    actor.send({ type: "BEGIN_LOAD" });
    expect(actor.getSnapshot().value).toBe("loading");
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

  it("mainMenu -> levelSelect via CHOOSE_ZONE, puis levelSelect -> loading", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "ENTER_MENU" });
    actor.send({ type: "CHOOSE_ZONE" });
    expect(actor.getSnapshot().value).toBe("levelSelect");
    actor.send({ type: "BEGIN_LOAD" });
    expect(actor.getSnapshot().value).toBe("loading");
  });

  it("playing -> dead via DIED", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "BEGIN_LOAD" });
    actor.send({ type: "PLAY" });
    actor.send({ type: "DIED" });
    expect(actor.getSnapshot().value).toBe("dead");
  });

  it("playing -> levelComplete via LEVEL_COMPLETED", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "BEGIN_LOAD" });
    actor.send({ type: "PLAY" });
    actor.send({ type: "LEVEL_COMPLETED" });
    expect(actor.getSnapshot().value).toBe("levelComplete");
  });

  it("dead -> loading via REPLAY, puis playing après succès", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "BEGIN_LOAD" });
    actor.send({ type: "PLAY" });
    actor.send({ type: "DIED" });
    actor.send({ type: "REPLAY" });
    expect(actor.getSnapshot().value).toBe("loading");
    actor.send({ type: "PLAY" });
    expect(actor.getSnapshot().value).toBe("playing");
  });

  it("dead -> mainMenu via RETURN_TO_MENU", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "BEGIN_LOAD" });
    actor.send({ type: "PLAY" });
    actor.send({ type: "DIED" });
    actor.send({ type: "RETURN_TO_MENU" });
    expect(actor.getSnapshot().value).toBe("mainMenu");
  });

  it("levelComplete -> loading via REPLAY, puis playing après succès", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "BEGIN_LOAD" });
    actor.send({ type: "PLAY" });
    actor.send({ type: "LEVEL_COMPLETED" });
    actor.send({ type: "REPLAY" });
    expect(actor.getSnapshot().value).toBe("loading");
    actor.send({ type: "PLAY" });
    expect(actor.getSnapshot().value).toBe("playing");
  });

  it("levelComplete -> mainMenu via RETURN_TO_MENU", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "BEGIN_LOAD" });
    actor.send({ type: "PLAY" });
    actor.send({ type: "LEVEL_COMPLETED" });
    actor.send({ type: "RETURN_TO_MENU" });
    expect(actor.getSnapshot().value).toBe("mainMenu");
  });

  it("playing -> paused via PAUSE", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "BEGIN_LOAD" });
    actor.send({ type: "PLAY" });
    actor.send({ type: "PAUSE" });
    expect(actor.getSnapshot().value).toBe("paused");
  });

  it("paused -> playing via RESUME", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "BEGIN_LOAD" });
    actor.send({ type: "PLAY" });
    actor.send({ type: "PAUSE" });
    actor.send({ type: "RESUME" });
    expect(actor.getSnapshot().value).toBe("playing");
  });

  it("paused -> mainMenu via RETURN_TO_MENU (quitter depuis la pause)", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "BEGIN_LOAD" });
    actor.send({ type: "PLAY" });
    actor.send({ type: "PAUSE" });
    actor.send({ type: "RETURN_TO_MENU" });
    expect(actor.getSnapshot().value).toBe("mainMenu");
  });

  it("le contenu du pas fixe reste ignoré indépendamment de PAUSE : DIED/LEVEL_COMPLETED sont des no-op depuis paused (pas déclarés pour cet état)", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "BEGIN_LOAD" });
    actor.send({ type: "PLAY" });
    actor.send({ type: "PAUSE" });
    actor.send({ type: "DIED" });
    expect(actor.getSnapshot().value).toBe("paused");
    actor.send({ type: "LEVEL_COMPLETED" });
    expect(actor.getSnapshot().value).toBe("paused");
  });

  it("scénario complet : boot -> menu -> jeu -> mort -> rejouer -> jeu", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "ENTER_MENU" });
    actor.send({ type: "BEGIN_LOAD" });
    actor.send({ type: "PLAY" });
    actor.send({ type: "DIED" });
    actor.send({ type: "REPLAY" });
    actor.send({ type: "PLAY" });
    expect(actor.getSnapshot().value).toBe("playing");
  });

  it("scénario complet : boot -> menu -> jeu -> fin de niveau -> retour au menu", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "ENTER_MENU" });
    actor.send({ type: "BEGIN_LOAD" });
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

  it("un échec de chargement impose un retry explicite avant de pouvoir jouer", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "BEGIN_LOAD" });
    actor.send({ type: "LOAD_FAILED" });
    expect(actor.getSnapshot().value).toBe("loadFailed");

    actor.send({ type: "PLAY" });
    expect(actor.getSnapshot().value).toBe("loadFailed");
    actor.send({ type: "RETRY_LOAD" });
    expect(actor.getSnapshot().value).toBe("loading");
    actor.send({ type: "PLAY" });
    expect(actor.getSnapshot().value).toBe("playing");
  });

  it("loading -> intro -> playing : les panneaux d'intro précèdent la partie", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "BEGIN_LOAD" });
    actor.send({ type: "SHOW_INTRO" });
    expect(actor.getSnapshot().value).toBe("intro");
    actor.send({ type: "PLAY" });
    expect(actor.getSnapshot().value).toBe("playing");
  });

  it("playing -> outro -> levelComplete : les panneaux de fin précèdent le récapitulatif", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "BEGIN_LOAD" });
    actor.send({ type: "PLAY" });
    actor.send({ type: "SHOW_OUTRO" });
    expect(actor.getSnapshot().value).toBe("outro");
    actor.send({ type: "LEVEL_COMPLETED" });
    expect(actor.getSnapshot().value).toBe("levelComplete");
  });

  it("la mort ne passe jamais par les panneaux de fin", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "BEGIN_LOAD" });
    actor.send({ type: "PLAY" });
    actor.send({ type: "DIED" });
    actor.send({ type: "SHOW_OUTRO" });
    expect(actor.getSnapshot().value).toBe("dead");
  });

  it("rejouer après la fin retourne en jeu sans repasser par l'intro", () => {
    const actor = createGameFlowActor();
    actor.send({ type: "BEGIN_LOAD" });
    actor.send({ type: "SHOW_INTRO" });
    actor.send({ type: "PLAY" });
    actor.send({ type: "SHOW_OUTRO" });
    actor.send({ type: "LEVEL_COMPLETED" });
    actor.send({ type: "REPLAY" });
    expect(actor.getSnapshot().value).toBe("loading");
    actor.send({ type: "PLAY" });
    expect(actor.getSnapshot().value).toBe("playing");
  });

  it("le pas fixe ne joue que dans playing : intro et outro ne comptent pas dans le chronomètre", () => {
    expect(isPlayingState("playing")).toBe(true);
    for (const state of ["intro", "outro", "paused", "loading", "levelComplete"] as const) {
      expect(isPlayingState(state), state).toBe(false);
    }
  });

  it("le monde physique tourne derrière les panneaux de fin, pas derrière ceux d'intro", () => {
    expect(isPhysicsLiveState("outro")).toBe(true);
    expect(isPhysicsLiveState("intro")).toBe(false);
    expect(isPhysicsLiveState("loading")).toBe(false);
  });
});
