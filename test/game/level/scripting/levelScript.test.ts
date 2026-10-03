import { describe, expect, it } from "vitest";

import {
  createLevelScriptState,
  updateLevelScript,
  type Scenario,
  type ScriptAction,
  type ScriptTrigger,
} from "../../../../src/game/level/scripting/levelScript";

const DT = 1 / 60;
const dedans = { x: 0, y: 1, z: 0 };
const dehors = { x: 50, y: 1, z: 0 };

const declencheur: ScriptTrigger = {
  name: "trig_essai",
  event: "essai",
  min: { x: -2, y: 0, z: -2 },
  max: { x: 2, y: 3, z: 2 },
};

const scenarios: Record<string, Scenario> = {
  essai: [
    { delay: 0, action: { kind: "annonce", speaker: "MAGASIN", text: "un" } },
    { delay: 1, action: { kind: "replique", id: "deux" } },
    { delay: 0.5, action: { kind: "reveiller", groupe: "trois" } },
  ],
};

function jouer(secondes: number, position: typeof dedans, state = createLevelScriptState()) {
  const actions: ScriptAction["kind"][] = [];
  for (let t = 0; t < secondes; t += DT) {
    updateLevelScript(state, [declencheur], scenarios, DT, position, (action) => actions.push(action.kind));
  }
  return { state, actions };
}

describe("updateLevelScript", () => {
  it("ne fait rien tant que le joueur est hors du volume", () => {
    expect(jouer(3, dehors).actions).toEqual([]);
  });

  it("exécute les actions dans l'ordre, chacune après son délai de gameplay", () => {
    expect(jouer(0.1, dedans).actions).toEqual(["annonce"]);
    expect(jouer(1.2, dedans).actions).toEqual(["annonce", "replique"]);
    expect(jouer(1.7, dedans).actions).toEqual(["annonce", "replique", "reveiller"]);
  });

  it("poursuit le scénario après la sortie du volume", () => {
    const { state } = jouer(0.1, dedans);
    expect(jouer(2, dehors, state).actions).toEqual(["replique", "reveiller"]);
  });

  it("ne se déclenche qu'une fois par partie, même en revenant dans le volume", () => {
    const { state } = jouer(3, dedans);
    jouer(1, dehors, state);
    expect(jouer(3, dedans, state).actions).toEqual([]);
    expect(state.running).toEqual([]);
  });

  it("le temps de gameplay arrêté n'avance pas le scénario", () => {
    const state = createLevelScriptState();
    const actions: string[] = [];
    updateLevelScript(state, [declencheur], scenarios, DT, dedans, (a) => actions.push(a.kind));
    for (let i = 0; i < 600; i++) updateLevelScript(state, [declencheur], scenarios, 0, dedans, (a) => actions.push(a.kind));
    expect(actions).toEqual(["annonce"]);
  });

  it("un déclencheur dont le scénario est inconnu est consommé sans effet", () => {
    const state = createLevelScriptState();
    const actions: string[] = [];
    updateLevelScript(state, [{ ...declencheur, event: "inconnu" }], scenarios, DT, dedans, (a) => actions.push(a.kind));
    expect(actions).toEqual([]);
    expect(state.fired.has("trig_essai")).toBe(true);
  });
});
