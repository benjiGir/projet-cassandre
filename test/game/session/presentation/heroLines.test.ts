/**
 * Le texte affiché d'une réplique doit être celui que la voix dit : chaque
 * entrée de `heroLines.ts` est comparée à la prise retenue
 * (`assets_src/audio_ia/retenus/voix/retenus.json`, écrit par
 * `tools/audio/ia_voix.py pick`) et doit exister dans le sprite livré au jeu.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { HERO_BARKS, HERO_LINES, heroVoiceKey, type HeroLineDef } from "../../../../src/game/session/presentation/heroLines";

function lireJson<T>(chemin: string): T {
  return JSON.parse(new TextDecoder().decode(readFileSync(resolve(chemin)))) as T;
}

const retenus = lireJson<Record<string, { texte: string }>>("assets_src/audio_ia/retenus/voix/retenus.json");
const sprite = lireJson<{ sprite: Record<string, unknown> }>("public/assets/audio/voix/voix.json").sprite;
const lignes: [string, HeroLineDef][] = Object.entries(HERO_LINES);
const textes: [string, string][] = [
  ...lignes.filter(([, def]) => !def.textOnly).map(([id, def]): [string, string] => [id, def.text]),
  ...Object.entries(HERO_BARKS),
];
const sansVoix = lignes.filter(([, def]) => def.textOnly).map(([id]) => id);

describe("répliques enregistrées du héros", () => {
  it.each(textes)("%s : le sous-titre est mot pour mot la prise retenue, présente dans le sprite", (id, texte) => {
    const cle = heroVoiceKey(id as keyof typeof HERO_LINES);
    expect(retenus[cle]?.texte).toBe(texte);
    expect(sprite[cle]).toBeDefined();
  });

  it.each(sansVoix)("%s : une réplique en texte seul n'a pas de prise — sinon retirer `textOnly`", (id) => {
    const cle = heroVoiceKey(id as keyof typeof HERO_LINES);
    expect(retenus[cle]).toBeUndefined();
    expect(sprite[cle]).toBeUndefined();
  });

  it("chaque prise retenue a sa place dans le jeu", () => {
    const branchees = new Set(textes.map(([id]) => heroVoiceKey(id as keyof typeof HERO_LINES)));
    expect(Object.keys(retenus).filter((cle) => cle.startsWith("heros_") && !branchees.has(cle))).toEqual([]);
  });
});
