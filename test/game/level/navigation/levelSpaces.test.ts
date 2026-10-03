import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  decodeLevelSpacesManifest,
  levelSpaceAt,
  sortLevelSpaces,
  type LevelSpaceData,
} from "../../../../src/game/level/navigation/levelSpaces";
import { HERO_LINES, PLACE_LINES, type HeroLineDef } from "../../../../src/game/session/presentation/heroLines";

const salle: LevelSpaceData = { id: "salle", x: [0, 20], y: [-1, 5], z: [0, 20] };
const reduit: LevelSpaceData = { id: "reduit", x: [0, 4], y: [-1, 5], z: [0, 4] };
const etage: LevelSpaceData = { id: "etage", x: [0, 20], y: [5.5, 10], z: [0, 20] };

describe("levelSpaceAt", () => {
  const spaces = sortLevelSpaces([salle, reduit, etage]);

  it("rend l'espace qui contient le point", () => {
    expect(levelSpaceAt(spaces, { x: 10, y: 1, z: 10 })).toBe("salle");
  });

  it("rend le plus petit espace quand deux se recouvrent", () => {
    expect(levelSpaceAt(spaces, { x: 2, y: 1, z: 2 })).toBe("reduit");
  });

  it("sépare deux espaces superposés par la hauteur", () => {
    expect(levelSpaceAt(spaces, { x: 10, y: 7, z: 10 })).toBe("etage");
  });

  it("rend null hors de tout espace", () => {
    expect(levelSpaceAt(spaces, { x: 50, y: 1, z: 10 })).toBeNull();
  });
});

describe("decodeLevelSpacesManifest", () => {
  it("refuse des bornes inversées", () => {
    expect(() => decodeLevelSpacesManifest({ espaces: [{ id: "a", x: [2, 1], y: [0, 1], z: [0, 1] }] })).toThrow();
  });
});

describe("manifeste livré de niveau_v2", () => {
  const manifeste = decodeLevelSpacesManifest(
    JSON.parse(new TextDecoder().decode(readFileSync(resolve("public/assets/levels/niveau_v2.espaces.json")))),
  );
  const ids = new Set(manifeste.espaces.map((espace) => espace.id));

  it("contient chaque espace auquel une réplique de lieu est attachée", () => {
    expect(Object.keys(PLACE_LINES).filter((id) => !ids.has(id))).toEqual([]);
  });

  it("place le départ du joueur sur le parking extérieur", () => {
    const spaces = sortLevelSpaces(manifeste.espaces);
    // Repère du jeu : le parking est au sud, donc en z positif.
    expect(levelSpaceAt(spaces, { x: 0, y: 1, z: 20 })).toBe("parking_ext");
  });
});

describe("répliques de lieu", () => {
  it("sont dites une fois, sans tirage : elles sont retentées à chaque pas fixe", () => {
    for (const id of Object.values(PLACE_LINES)) {
      const def: HeroLineDef = HERO_LINES[id];
      expect(def.once, id).toBe(true);
      expect(def.chance, id).toBeUndefined();
      expect(def.priority, id).toBeUndefined();
    }
  });
});
