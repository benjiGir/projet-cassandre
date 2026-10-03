import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import deliveredImages from "../../../../src/game/session/presentation/storyImages.json";
import { levelStory, STORY_IMAGE_DIR } from "../../../../src/game/session/presentation/storyPanels";

// Liste vide tant qu'aucune image n'est livrée : son type inféré serait `never[]`.
const livrees: readonly string[] = deliveredImages;

describe("panneaux d'histoire", () => {
  it("le niveau principal a quatre panneaux d'intro et quatre de fin", () => {
    const story = levelStory("niveau_v2");
    expect(story?.intro).toHaveLength(4);
    expect(story?.outro).toHaveLength(4);
  });

  it("chaque panneau a un identifiant unique, une description et une légende", () => {
    const story = levelStory("niveau_v2")!;
    const panels = [...story.intro, ...story.outro];
    expect(new Set(panels.map((panel) => panel.id)).size).toBe(panels.length);
    for (const panel of panels) {
      expect(panel.alt.length, panel.id).toBeGreaterThan(0);
      expect(panel.caption.length, panel.id).toBeGreaterThan(0);
      expect(new Set(panel.caption).size, panel.id).toBe(panel.caption.length);
    }
  });

  it("chaque image livrée appartient à un panneau, existe sur disque et y est seule", () => {
    const story = levelStory("niveau_v2")!;
    const ids = new Set([...story.intro, ...story.outro].map((panel) => panel.id));
    const dossier = resolve("public", STORY_IMAGE_DIR);
    const fichiers = existsSync(dossier) ? readdirSync(dossier).filter((nom) => nom.endsWith(".png")) : [];
    expect(livrees.filter((id) => !ids.has(id))).toEqual([]);
    expect(fichiers.sort()).toEqual(livrees.map((id) => `${id}.png`).sort());
  });

  it("un panneau ne référence une image que si elle est livrée", () => {
    const story = levelStory("niveau_v2")!;
    for (const panel of [...story.intro, ...story.outro]) {
      const attendu = livrees.includes(panel.id) ? `${STORY_IMAGE_DIR}/${panel.id}.png` : null;
      expect(panel.image, panel.id).toBe(attendu);
    }
  });

  it("un niveau sans histoire n'a ni intro ni fin", () => {
    expect(levelStory("gym")).toBeNull();
  });
});
