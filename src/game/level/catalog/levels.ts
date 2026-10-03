// see: docs/2-fonctionnel/le-niveau.md

export interface LevelDef {
  /** Identifiant stable. Sert aussi de valeur pour le raccourci `?level=<id>` et de clé du registre. */
  id: string;
  /** Libellé affiché dans le menu de choix de niveau. */
  label: string;
  /** "gym" = boîte blanche construite à la main (gym.ts). "gltf" = pipeline glTF (loader.ts/hotReload.ts). */
  kind: "gym" | "gltf";
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
}

// Rôle de chaque zone, pourquoi armée/désarmée, note Zone D (pathfinding) :
export const LEVEL_CHOICES: LevelDef[] = [
  { id: "gym", label: "Gym (test)", kind: "gym" },
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
