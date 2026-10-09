// see: docs/2-fonctionnel/le-niveau.md
import { METRO_TRAIN_EVENTS } from "../trains/metroTrainEvents";
import type { Scenario } from "../scripting/levelScript";

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
  mysteryDonations?: boolean;
}

// Rôle de chaque zone, pourquoi armée/désarmée, note Zone D (pathfinding) :
export const LEVEL_CHOICES: LevelDef[] = [
  { id: "gym", label: "Gym (test)", kind: "gym" },
  {
    id: "metro",
    label: "Le métro — parcours N5",
    kind: "gltf",
    gltfName: "metro_blockout",
    lighting: "hybride",
    ciel: "nuit",
    ambience: "quartier_pilote",
    spaces: true,
    scenarios: {},
    mysteryDonations: false,
  },
  ...(import.meta.env.DEV
    ? [
        {
          id: "blockout_metro",
          label: "Blockout — Métro complet (N5)",
          kind: "gltf" as const,
          gltfName: "metro_blockout",
          lighting: "hybride" as const,
          ciel: "nuit",
          ambience: "quartier_pilote",
          spaces: true,
          scenarios: {},
          mysteryDonations: false,
        },
      ]
    : []),
  ...(import.meta.env.DEV
    ? [{ id: "essai_trains", label: "Essai — Trains du métro (T1)", kind: "train-gym" as const }]
    : []),
  ...(import.meta.env.DEV
    ? [{ id: "essai_voyage_rame", label: "Essai — Voyage à bord (T4)", kind: "train-ride-gym" as const }]
    : []),
  ...(import.meta.env.DEV
    ? [
        {
          id: "pilote_metro",
          label: "Pilote — Quai et tunnel (N4)",
          kind: "gltf" as const,
          gltfName: "metro_pilote",
          lighting: "hybride" as const,
          ambience: "metro_pilote",
          spaces: true,
          scenarios: {},
        },
      ]
    : []),
  ...(import.meta.env.DEV
    ? [
        {
          id: "pilote_quartier",
          label: "Pilote — Place du quartier (N4b)",
          kind: "gltf" as const,
          gltfName: "quartier_pilote",
          lighting: "hybride" as const,
          ciel: "nuit",
          ambience: "quartier_pilote",
          spaces: true,
          scenarios: {},
          mysteryDonations: false,
        },
      ]
    : []),
  ...(import.meta.env.DEV
    ? [
        {
          id: "trains_metro",
          label: "Essai — Trains intégrés (T2)",
          kind: "gltf" as const,
          gltfName: "metro_trains",
          lighting: "hybride" as const,
          ambience: "metro_pilote",
          spaces: true,
          scenarios: METRO_TRAIN_EVENTS,
        },
      ]
    : []),
  { id: "zone_a_parking", label: "Zone A — Parking", kind: "gltf", gltfName: "zone_a_parking", startUnarmed: true },
  { id: "zone_b_caisses", label: "Zone B — Caisses", kind: "gltf", gltfName: "zone_b_caisses" },
  { id: "zone_c_rayons", label: "Zone C — Rayons", kind: "gltf", gltfName: "zone_c_rayons" },
  { id: "zone_d_reserve", label: "Zone D — Réserve", kind: "gltf", gltfName: "zone_d_reserve" },
  { id: "zone_e_bureau", label: "Zone E — Bureau", kind: "gltf", gltfName: "zone_e_bureau" },
  // Salle d'essai du chantier Niveau v2 (jalon N4) : sert à juger la richesse
  // visuelle de la bibliothèque d'assets, pas à jouer. Voir PLAN_NIVEAU_V2.md.
  {
    id: "salle_essai_rayons",
    label: "Essai — Rayons (niveau v2)",
    kind: "gltf",
    gltfName: "salle_essai_rayons",
    lighting: "hybride",
  },
  // see: docs/6-reference/notes-code-gameplay-niveau.md#chargement-et-ressources
  {
    id: "blockout_v2",
    label: "Blockout — Niveau v2",
    kind: "gltf",
    gltfName: "blockout_v2",
    startUnarmed: true,
  },
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
  // Niveau complet : les 5 zones individuelles ci-dessus restent disponibles pour du test ciblé.
  {
    id: "hypermarche_complet",
    label: "Niveau complet — L'Hypermarché",
    kind: "gltf",
    gltfName: "hypermarche_complet",
    startUnarmed: true,
  },
];
