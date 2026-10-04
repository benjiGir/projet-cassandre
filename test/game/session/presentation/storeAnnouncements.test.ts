/**
 * Le texte affiché d'une annonce doit être celui que la voix dit : chaque
 * entrée de `storeAnnouncements.ts` est comparée à la prise retenue
 * (`assets_src/audio_ia/retenus/voix/retenus.json`) et doit exister dans le
 * sprite livré au jeu.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  STORE_ANNOUNCEMENTS,
  announcementVoiceKey,
  type StoreAnnouncementId,
} from "../../../../src/game/session/presentation/storeAnnouncements";

function lireJson<T>(chemin: string): T {
  return JSON.parse(new TextDecoder().decode(readFileSync(resolve(chemin)))) as T;
}

const retenus = lireJson<Record<string, { texte: string }>>("assets_src/audio_ia/retenus/voix/retenus.json");
const sprite = lireJson<{ sprite: Record<string, unknown> }>("public/assets/audio/voix/voix.json").sprite;
const annonces = Object.entries(STORE_ANNOUNCEMENTS) as [StoreAnnouncementId, string][];

describe("annonces enregistrées du magasin", () => {
  it.each(annonces)("%s : le texte est mot pour mot la prise retenue, présente dans le sprite", (id, texte) => {
    const cle = announcementVoiceKey(id);
    expect(retenus[cle]?.texte).toBe(texte);
    expect(sprite[cle]).toBeDefined();
  });

  it("chaque prise d'annonce retenue a sa place dans le jeu", () => {
    const branchees = new Set(annonces.map(([id]) => announcementVoiceKey(id)));
    expect(Object.keys(retenus).filter((cle) => cle.startsWith("annonce_") && !branchees.has(cle))).toEqual([]);
  });
});
