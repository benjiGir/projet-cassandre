import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import type { NamedSpawn, TriggerVolume } from "../../../../src/game/level/loading/levelTypes";
import type { Scenario } from "../../../../src/game/level/scripting/levelScript";
import { LEVEL_EVENTS } from "../../../../src/game/session/progression/levelEvents";
import { readLevelScript } from "../../../../src/game/session/progression/levelScriptSetup";
import { HERO_LINES, PLACE_LINES } from "../../../../src/game/session/presentation/heroLines";

function trig(name: string, extras: Record<string, unknown>): TriggerVolume {
  return {
    name,
    object: new THREE.Object3D(),
    min: new THREE.Vector3(0, 0, 0),
    max: new THREE.Vector3(2, 3, 4),
    extras,
  };
}

function spawn(name: string, group: string | null): NamedSpawn {
  return { name, position: new THREE.Vector3(), group };
}

const scenarios: Record<string, Scenario> = {
  embuscade: [
    { delay: 0, action: { kind: "reveiller", groupe: "renfort" } },
    { delay: 0, action: { kind: "chaine", ecrans: "ecran_mur_", chaine: "cctv" } },
  ],
};

describe("readLevelScript", () => {
  it("retient un déclencheur d'événement et une sous-zone à réplique", () => {
    const setup = readLevelScript(
      [trig("trig_embuscade", { evenement: "embuscade" }), trig("trig_lieu_surgeles", { replique: "surgeles" })],
      [spawn("spawn_suit_a", "renfort")],
      ["ecran_mur_0"],
      scenarios,
    );
    expect(setup.problems).toEqual([]);
    expect(setup.triggers.map((t) => t.name)).toEqual(["trig_embuscade"]);
    expect(setup.placeSpaces).toEqual([{ id: "trig_lieu_surgeles", x: [0, 2], y: [0, 3], z: [0, 4] }]);
    expect(setup.placeLines.get("trig_lieu_surgeles")).toBe("surgeles");
    expect(setup.placeLines.get("galerie")).toBe(PLACE_LINES.galerie);
  });

  it("signale un événement inconnu, une réplique inconnue et un déclencheur vide, sans les retenir", () => {
    const setup = readLevelScript(
      [trig("trig_a", { evenement: "nexiste_pas" }), trig("trig_b", { replique: "nexiste_pas" }), trig("trig_c", {})],
      [spawn("spawn_suit_a", "renfort")],
      ["ecran_mur_0"],
      scenarios,
    );
    expect(setup.triggers).toEqual([]);
    expect(setup.placeSpaces).toEqual([]);
    expect(setup.problems).toHaveLength(3);
  });

  it("signale un groupe que rien ne réveille, un réveil sans spawn et des écrans introuvables", () => {
    const setup = readLevelScript([], [spawn("spawn_suit_a", "oublie")], [], scenarios);
    expect(setup.problems).toHaveLength(3);
    expect(setup.problems.join("\n")).toContain("oublie");
    expect(setup.problems.join("\n")).toContain("renfort");
    expect(setup.problems.join("\n")).toContain("ecran_mur_");
  });
});

describe("readLevelScript — arènes", () => {
  const arene: Record<string, Scenario> = {
    arene: [
      { delay: 0, action: { kind: "verrouiller", portes: ["door_nord", "door_sud"] } },
      { delay: 0, action: { kind: "reveiller", groupe: "vague" } },
      {
        delay: 0,
        apres: { groupe: "vague", auPlusTard: 30 },
        action: { kind: "deverrouiller", portes: ["door_nord", "door_sud"] },
      },
    ],
  };

  it("accepte une arène dont les portes et le groupe existent", () => {
    const setup = readLevelScript([], [spawn("spawn_suit_a", "vague")], [], arene, ["door_nord", "door_sud"]);
    expect(setup.problems).toEqual([]);
  });

  it("signale une porte absente du niveau et une attente sur un groupe sans spawn", () => {
    const fautive: Record<string, Scenario> = {
      arene: [
        ...arene.arene,
        { delay: 0, apres: { groupe: "fantome", auPlusTard: 30 }, action: { kind: "replique", id: "quai" } },
      ],
    };
    const setup = readLevelScript([], [spawn("spawn_suit_a", "vague")], [], fautive, ["door_nord"]);
    const texte = setup.problems.join("\n");
    expect(texte).toContain("door_sud");
    expect(texte).not.toContain("door_nord");
    expect(texte).toContain("fantome");
  });
});

describe("scénarios du niveau", () => {
  it("une arène rend toujours les portes qu'elle a prises, et chaque attente a son garde-fou", () => {
    for (const [event, steps] of Object.entries<Scenario>(LEVEL_EVENTS)) {
      const prises = steps.flatMap(({ action }) => (action.kind === "verrouiller" ? action.portes : []));
      const rendues = steps.flatMap(({ action }) => (action.kind === "deverrouiller" ? action.portes : []));
      expect([...rendues].sort(), event).toEqual([...prises].sort());
      for (const { apres } of steps) {
        if (!apres) continue;
        expect(apres.auPlusTard, event).toBeGreaterThan(0);
        expect(apres.auPlusTard, event).toBeLessThanOrEqual(120);
      }
    }
  });

  it("chaque réplique citée existe et ne dépend pas d'un tirage", () => {
    for (const [event, steps] of Object.entries<Scenario>(LEVEL_EVENTS)) {
      for (const { action, delay } of steps) {
        expect(delay, event).toBeGreaterThanOrEqual(0);
        if (action.kind !== "replique") continue;
        expect(Object.hasOwn(HERO_LINES, action.id), `${event} : ${action.id}`).toBe(true);
      }
    }
  });

  it("le validateur Blender lit ses listes dans les sources du jeu", () => {
    // `validate_level.py` retrouve les événements et les répliques par ces motifs :
    // un changement de mise en forme des deux fichiers doit faire échouer ce test.
    const lire = (chemin: string) => new TextDecoder().decode(readFileSync(resolve(chemin)));
    const events = [...lire("src/game/session/progression/levelEvents.ts").matchAll(/^ {2}(\w+): \[/gm)].map(
      (m) => m[1],
    );
    const lines = [...lire("src/game/session/presentation/heroLines.ts").matchAll(/^ {2}(\w+): \{ text:/gm)].map(
      (m) => m[1],
    );
    expect(events.sort()).toEqual(Object.keys(LEVEL_EVENTS).sort());
    expect(lines.sort()).toEqual(Object.keys(HERO_LINES).sort());
  });
});
