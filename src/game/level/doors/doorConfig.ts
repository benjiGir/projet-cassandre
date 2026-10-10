import * as THREE from "three";
import {
  DOOR_MOVEMENTS,
  type DoorMovement,
  type DoorHinge,
  type DoorSens,
  type DoorAuto,
  type DoorManualMode,
  type ParsedDoorConfig,
} from "./doorTypes";

// see: docs/6-reference/notes-code-gameplay-niveau.md#portes

export const DEFAULT_DOOR_MOVEMENT: DoorMovement = "descend";

export function parseDoorMovement(raw: unknown): DoorMovement | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  return (DOOR_MOVEMENTS as readonly string[]).includes(value) ? (value as DoorMovement) : null;
}

/** Portée de l'action manuelle, mètres — la même que celle d'un `use_*`, pour que « agir » ait une seule distance dans tout le jeu. */
export const MANUAL_ACTION_RANGE = 2;

/** Durée d'ouverture par défaut, secondes — valeurs du contrat, une par mouvement. */
const MOVEMENT_DEFAULT_DURATION: Record<DoorMovement, number> = {
  battant: 0.5,
  coulisse: 0.45,
  monte: 1.4,
  descend: 0.6,
};

const DEFAULT_ANGLE_DEG = 95;

const DEFAULT_RANGE = 2.5;

/** |Δaltitude| max d'une porte `auto`, mètres — fixe, pas exposé en extra (le contrat ne le rend pas paramétrable). */
export const AUTO_ALTITUDE_TOLERANCE = 2;

const DEFAULT_DELAY = 1.2;

export function parseDoorConfig(movement: DoorMovement, extras: Record<string, unknown>): ParsedDoorConfig {
  const charniere: DoorHinge = extras.charniere === "max" ? "max" : "min";

  const angleDeg = typeof extras.angle === "number" && Number.isFinite(extras.angle) ? extras.angle : DEFAULT_ANGLE_DEG;

  const sens: DoorSens = extras.sens === "+" || extras.sens === "-" ? extras.sens : "auto";

  const course =
    typeof extras.course === "number" && Number.isFinite(extras.course) && extras.course > 0 ? extras.course : null;

  const duration =
    typeof extras.duree === "number" && Number.isFinite(extras.duree) && extras.duree > 0
      ? extras.duree
      : MOVEMENT_DEFAULT_DURATION[movement];

  const autoQui: DoorAuto = extras.auto === true ? "tous" : extras.auto === "ennemis" ? "ennemis" : "non";
  const auto = autoQui !== "non";

  const manual: DoorManualMode =
    extras.manuelle === true ? "les-deux" : extras.manuelle === "fermer" ? "fermer" : "non";

  const referme = typeof extras.referme === "boolean" ? extras.referme : true;

  const delay =
    typeof extras.delai === "number" && Number.isFinite(extras.delai) && extras.delai >= 0
      ? extras.delai
      : DEFAULT_DELAY;

  const groupe = typeof extras.groupe === "string" && extras.groupe.trim() !== "" ? extras.groupe.trim() : null;

  const range =
    typeof extras.portee === "number" && Number.isFinite(extras.portee) && extras.portee > 0
      ? extras.portee
      : DEFAULT_RANGE;

  return {
    charniere,
    angleRad: THREE.MathUtils.degToRad(angleDeg),
    sens,
    autoQui,
    manuelle: manual,
    course,
    duree: duration,
    auto,
    referme,
    delai: delay,
    groupe,
    portee: range,
    ouverte: extras.ouverte === true,
  };
}
