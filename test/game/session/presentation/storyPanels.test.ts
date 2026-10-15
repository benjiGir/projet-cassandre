import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import deliveredImages from "../../../../src/game/session/presentation/storyImages.json";
import { levelStory, STORY_IMAGE_DIR } from "../../../../src/game/session/presentation/storyPanels";

// Liste vide tant qu'aucune image n'est livrée : son type inféré serait `never[]`.
const livrees: readonly string[] = deliveredImages;

const NIVEAUX = ["niveau_v2", "metro"] as const;

function tousLesPanneaux() {
  return NIVEAUX.flatMap((niveau) => {
    const story = levelStory(niveau)!;
    return [...story.intro, ...story.outro];
  });
}

describe("panneaux d'histoire", () => {
  it.each(NIVEAUX)("%s a quatre panneaux d'intro et quatre de fin", (niveau) => {
    const story = levelStory(niveau);
    expect(story?.intro).toHaveLength(4);
    expect(story?.outro).toHaveLength(4);
  });

  it("chaque panneau a un identifiant unique, une description et une légende", () => {
    const panels = tousLesPanneaux();
    expect(new Set(panels.map((panel) => panel.id)).size).toBe(panels.length);
    for (const panel of panels) {
      expect(panel.alt.length, panel.id).toBeGreaterThan(0);
      expect(panel.caption.length, panel.id).toBeGreaterThan(0);
      expect(new Set(panel.caption).size, panel.id).toBe(panel.caption.length);
    }
  });

  it("chaque image livrée appartient à un panneau, existe sur disque et y est seule", () => {
    const ids = new Set(tousLesPanneaux().map((panel) => panel.id));
    const dossier = resolve("public", STORY_IMAGE_DIR);
    const fichiers = existsSync(dossier) ? readdirSync(dossier).filter((nom) => nom.endsWith(".png")) : [];
    expect(livrees.filter((id) => !ids.has(id))).toEqual([]);
    expect(fichiers.sort()).toEqual(livrees.map((id) => `${id}.png`).sort());
  });

  it("un panneau ne référence une image que si elle est livrée", () => {
    for (const panel of tousLesPanneaux()) {
      const attendu = livrees.includes(panel.id) ? `${STORY_IMAGE_DIR}/${panel.id}.png` : null;
      expect(panel.image, panel.id).toBe(attendu);
    }
  });

  it("un niveau sans histoire n'a ni intro ni fin", () => {
    expect(levelStory("gym")).toBeNull();
  });
});
