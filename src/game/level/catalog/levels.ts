// see: docs/2-fonctionnel/le-niveau.md
import { METRO_ENCOUNTER_EVENTS } from "../blockout/metroEncounterEvents";
import type { Scenario } from "../scripting/levelScript";

/** Jeux de textes d'un niveau : réplique d'ouverture, chat et dons, étapes du donateur de l'histoire. */
export type LevelTexts = "magasin" | "metro";

export interface LevelDef {
  /** Identifiant stable. Sert aussi de valeur pour le raccourci `?level=<id>` et de clé du registre. */
  id: string;
  /** Libellé affiché dans le menu de choix de niveau. */
  label: string;
  /** "gym" = boîte blanche construite à la main (gym.ts). "gltf" = pipeline glTF (loader.ts/hotReload.ts). */
  kind: "gym" | "train-gym" | "train-ride-gym" | "gltf";
  /** Nom de fichier sous public/assets/levels/<gltfName>.glb, sans extension. Uniquement pour kind === "gltf". */
  gltfName?: string;
  /** Le joueur démarre désarmé (pied-de-biche au sol, ramassable via use_crowbar) — voir WeaponSystem.startUnarmed()/pickUpMelee(). */
  startUnarmed?: boolean;
  // see: docs/archive/systems-rendu.md#éclairage-de-scène-selon-le-niveau
  lighting?: "temps-reel" | "bake" | "hybride";
  // see: docs/archive/systems-rendu.md#ciel
  ciel?: string;
  // see: docs/archive/systems-session.md#récapitulatif-de-fin-de-partie
  parTime?: number;
  /** Le niveau livre `<gltfName>.espaces.json` (`tools/level_v2/espaces_jeu.py`) : il porte les répliques de lieu. */
  spaces?: boolean;
  /** Dossier d'ambiance sous assets/audio, préparé avant la session. */
  ambience?: string;
  /** Scénarios propres au niveau ; absent = registre historique du magasin. */
  scenarios?: Readonly<Record<string, Scenario>>;
  /** Jeu de textes du niveau ; absent = celui du magasin. */
  textes?: LevelTexts;
  mysteryDonations?: boolean;
}

/** Le parcours du métro : le niveau de campagne et son entrée de dev partagent ces réglages. */
const METRO_LEVEL: Omit<LevelDef, "id" | "label"> = {
  kind: "gltf",
  gltfName: "metro_blockout",
  lighting: "hybride",
  ciel: "nuit",
  ambience: "quartier_pilote",
  spaces: true,
  scenarios: METRO_ENCOUNTER_EVENTS,
  textes: "metro",
};

/** Salles d'essai et accès directs : jamais proposés hors développement. */
const DEV_LEVELS: LevelDef[] = [
  {
    id: "etalon_da",
    label: "Étalon DA — proposition",
    kind: "gltf",
    gltfName: "etalon_da",
    lighting: "hybride",
    scenarios: {},
    mysteryDonations: false,
  },
  {
    id: "etalon_da_avant",
    label: "Étalon DA — matières actuelles",
    kind: "gltf",
    gltfName: "etalon_da_avant",
    lighting: "hybride",
    scenarios: {},
    mysteryDonations: false,
  },
  // Le même niveau que `metro`, sans l'équipement d'arrivée ni les panneaux de la campagne.
  { id: "blockout_metro", label: "Blockout — Métro complet (N5)", ...METRO_LEVEL },
  { id: "essai_trains", label: "Essai — Trains du métro (T1)", kind: "train-gym" },
  { id: "essai_voyage_rame", label: "Essai — Voyage à bord (T4)", kind: "train-ride-gym" },
];

// Les étalons et salles d'essai restent accessibles seulement en développement.
export const LEVEL_CHOICES: LevelDef[] = [
  { id: "gym", label: "Gym (test)", kind: "gym" },
  { id: "metro", label: "Le métro — parcours N5", ...METRO_LEVEL },
  ...(import.meta.env.DEV ? DEV_LEVELS : []),
  {
    id: "niveau_v2",
    label: "Niveau v2 — habillé",
    kind: "gltf",
    gltfName: "niveau_v2",
    startUnarmed: true,
    lighting: "hybride",
    // La nuit au-dessus du parking d'arrivée et derrière les verrières.
    ciel: "nuit",
    // 10 minutes — le haut de la fourchette « 8-10 minutes » du proto
    // (CLAUDE.md), pour laisser une vraie marge de bonus à qui explore.
    parTime: 600,
    spaces: true,
  },
];
