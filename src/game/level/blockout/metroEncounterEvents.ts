import {
  METRO_ANNOUNCEMENTS,
  METRO_SPEAKERS,
  type MetroAnnouncementId,
  type MetroSpeakerId,
} from "../../session/presentation/metroAnnouncements";
import type { Scenario, ScriptAction } from "../scripting/levelScript";

// see: docs/4-technique/rencontres-metro.md — les rencontres ; docs/6-reference/repliques-metro.md — ce qui s'y dit.

/** Réplique du héros, par son identifiant (`heroLines.ts`) : un test vérifie qu'elle existe. */
function replique(id: string): ScriptAction {
  return { kind: "replique", id };
}

function annonce(speaker: MetroSpeakerId, id: MetroAnnouncementId): ScriptAction {
  return { kind: "annonce", speaker: METRO_SPEAKERS[speaker], text: METRO_ANNOUNCEMENTS[id] };
}

/** Garde-fou d'une réplique d'après combat : au-delà, elle part même si un ennemi vit encore. */
const APRES_AU_PLUS_TARD = 75;

/**
 * Scénarios du métro. Ceux d'un `trig_*` portent le nom de sa custom property
 * `evenement` ; les autres sont lancés par `MetroBlockout` (commandes, voyage).
 * Contrat avec `tools/blender/validate_level.py`, qui lit ce fichier par
 * expression régulière : une clé par ligne, et `reveiller` écrit en toutes lettres.
 */
export const METRO_ENCOUNTER_EVENTS = {
  metro_quartier: [{ delay: 0, action: { kind: "reveiller", groupe: "metro_quartier" } }],
  metro_billets: [
    { delay: 0, action: annonce("station", "sans_titre") },
    { delay: 1.2, action: { kind: "reveiller", groupe: "metro_billets_tireurs" } },
    { delay: 0, action: { kind: "reveiller", groupe: "metro_billets_garde" } },
    { delay: 3.3, action: annonce("station", "camera") },
    { delay: 3, action: replique("metro_sans_titre") },
  ],
  metro_quais_sud: [
    { delay: 0, action: { kind: "reveiller", groupe: "metro_quais_sud" } },
    { delay: 0.5, action: annonce("station", "trafic") },
  ],
  metro_quais_nord: [
    { delay: 0, action: { kind: "reveiller", groupe: "metro_quais_nord" } },
    { delay: 0, action: { kind: "reveiller", groupe: "metro_quais_garde" } },
  ],
  metro_galerie_entree: [{ delay: 0.5, action: { kind: "reveiller", groupe: "metro_galerie_entree" } }],
  metro_galerie_coude: [
    { delay: 0.5, action: { kind: "reveiller", groupe: "metro_galerie_coude" } },
    {
      delay: 1.5,
      apres: { groupe: "metro_galerie_coude", auPlusTard: APRES_AU_PLUS_TARD },
      action: replique("metro_nichee"),
    },
  ],
  metro_galerie_retour: [{ delay: 0.5, action: { kind: "reveiller", groupe: "metro_galerie_retour" } }],
  metro_depot: [
    { delay: 0, action: { kind: "reveiller", groupe: "metro_depot_tireurs" } },
    { delay: 0, action: { kind: "reveiller", groupe: "metro_depot_garde" } },
    { delay: 0.8, action: annonce("station", "depot") },
  ],
  metro_acces_poste: [{ delay: 0, action: { kind: "reveiller", groupe: "metro_acces_poste" } }],
  metro_machinerie: [
    { delay: 0, action: { kind: "reveiller", groupe: "metro_machinerie_tireurs" } },
    { delay: 1, action: { kind: "reveiller", groupe: "metro_machinerie_meute" } },
  ],
  metro_aiguillage: [
    { delay: 1.2, action: annonce("regulation", "voie_service") },
    { delay: 2.5, action: replique("metro_aiguillage") },
  ],
  metro_courant: [{ delay: 1.2, action: replique("metro_courant") }],
  metro_depart_refuse: [{ delay: 0.6, action: replique("metro_depart_refuse") }],
  metro_depart: [
    { delay: 1, action: annonce("rame", "depart") },
    { delay: 3, action: replique("metro_depart_rame") },
  ],
  metro_rame_1_nord: [
    { delay: 0, action: annonce("rame", "controle") },
    { delay: 0.25, action: { kind: "reveiller", groupe: "metro_rame_1_nord", alerte: true } },
    { delay: 1.5, action: replique("metro_rame_vague_1") },
  ],
  metro_rame_1_sud: [
    { delay: 0, action: annonce("rame", "controle") },
    { delay: 0.25, action: { kind: "reveiller", groupe: "metro_rame_1_sud", alerte: true } },
    { delay: 1.5, action: replique("metro_rame_vague_1") },
  ],
  metro_rame_2_nord: [
    { delay: 0, action: annonce("rame", "controle_suite") },
    { delay: 0.25, action: { kind: "reveiller", groupe: "metro_rame_2_nord", alerte: true } },
    { delay: 1.5, action: replique("metro_rame_vague_2") },
  ],
  metro_rame_2_sud: [
    { delay: 0, action: annonce("rame", "controle_suite") },
    { delay: 0.25, action: { kind: "reveiller", groupe: "metro_rame_2_sud", alerte: true } },
    { delay: 1.5, action: replique("metro_rame_vague_2") },
  ],
  metro_arrivee: [
    { delay: 0, action: { kind: "reveiller", groupe: "metro_arrivee" } },
    { delay: 0.5, action: annonce("rame", "terminus") },
    { delay: 2.5, action: replique("metro_arrivee") },
  ],
  metro_parvis: [
    { delay: 0, action: { kind: "reveiller", groupe: "metro_parvis_tireurs" } },
    { delay: 0, action: { kind: "reveiller", groupe: "metro_parvis_garde" } },
  ],
} as const satisfies Record<string, Scenario>;

export type MetroEncounterEvent = keyof typeof METRO_ENCOUNTER_EVENTS;
