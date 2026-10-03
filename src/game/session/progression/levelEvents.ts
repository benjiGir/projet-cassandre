import type { Scenario, ScriptAction } from "../../level/scripting/levelScript";
import type { HeroLineId } from "../presentation/heroLines";

// see: docs/2-fonctionnel/histoire.md#les-quatre-moments-en-jeu

const MAGASIN = "ANNONCE MAGASIN";
const INTERPHONE = "INTERPHONE · LA DIRECTION";

function replique(id: HeroLineId): ScriptAction {
  return { kind: "replique", id };
}

function annonce(speaker: string, text: string): ScriptAction {
  return { kind: "annonce", speaker, text };
}

/**
 * Scénarios nommés par la custom property `evenement` d'un `trig_*`. Le nom
 * est le contrat avec Blender : `tools/blender/validate_level.py::EVENEMENTS`
 * doit lister les mêmes.
 */
export const LEVEL_EVENTS = {
  annonce_caisses: [
    { delay: 0, action: annonce(MAGASIN, "Un client non identifié est attendu en caisse centrale.") },
    { delay: 4.5, action: annonce(MAGASIN, "Merci de ne pas gêner les opérations de sécurité.") },
  ],
  ecrans_sav: [
    { delay: 0.8, action: { kind: "chaine", ecrans: "ecran_sav_", chaine: "cctv" } },
    { delay: 1.2, action: replique("ecrans_filment") },
  ],
  livraison_quai: [{ delay: 0.5, action: replique("quai") }],
  interphone_direction: [
    { delay: 0, action: annonce(INTERPHONE, "Vous auriez dû prendre rendez-vous.") },
    { delay: 3.5, action: annonce(INTERPHONE, "Personne ne vous croira.") },
    { delay: 2.5, action: replique("boss_rencontre") },
  ],
} as const satisfies Record<string, Scenario>;

export type LevelEventId = keyof typeof LEVEL_EVENTS;
