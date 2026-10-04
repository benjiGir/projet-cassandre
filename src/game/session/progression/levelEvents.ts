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

/** Les quatre issues de la réserve, fermées le temps de l'arène. */
const ARENE_RESERVE = ["door_argent", "door_reserve_nord", "door_compacteur_reserve", "door_sav_reserve"];
/** Garde-fou d'une vague : au-delà, le script continue même si un ennemi vit encore. */
const VAGUE_AU_PLUS_TARD = 75;

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
  // see: docs/decisions/0037-script-de-niveau.md — les rencontres (lot B6). `reveiller`
  // s'écrit en toutes lettres : `validate_level.py` lit les groupes dans ce fichier.
  arene_reserve: [
    { delay: 0, action: { kind: "verrouiller", portes: ARENE_RESERVE } },
    { delay: 0.4, action: annonce(MAGASIN, "La réserve est fermée pour inventaire exceptionnel.") },
    { delay: 1.6, action: { kind: "reveiller", groupe: "arene_1" } },
    { delay: 1.2, action: replique("arene_piege") },
    {
      delay: 1.5,
      apres: { groupe: "arene_1", auPlusTard: VAGUE_AU_PLUS_TARD },
      action: annonce(MAGASIN, "Renfort demandé en réserve. Le personnel non essentiel est prié de mordre."),
    },
    { delay: 1, action: { kind: "reveiller", groupe: "arene_2" } },
    {
      delay: 2,
      apres: { groupe: "arene_2", auPlusTard: VAGUE_AU_PLUS_TARD },
      action: { kind: "deverrouiller", portes: ARENE_RESERVE },
    },
    { delay: 0.5, action: annonce(MAGASIN, "L'inventaire est terminé. Hyper Varan vous remercie de votre patience.") },
    { delay: 1.5, action: replique("arene_fin") },
  ],
  souterrain_descente: [
    { delay: 1, action: replique("souterrain_bruit") },
    { delay: 3.5, action: { kind: "reveiller", groupe: "souterrain_eclaireurs" } },
  ],
  souterrain_carte: [
    { delay: 0.8, action: { kind: "reveiller", groupe: "souterrain_meute" } },
    { delay: 0.6, action: replique("souterrain_meute") },
    { delay: 6, action: annonce(INTERPHONE, "Sécurité, à l'escalier des bureaux. Il a la carte.") },
    { delay: 0.5, action: { kind: "reveiller", groupe: "escalier" } },
  ],
} as const satisfies Record<string, Scenario>;

export type LevelEventId = keyof typeof LEVEL_EVENTS;
