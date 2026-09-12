/**
 * Registre de niveaux — remplace le hardcode qui vivait dans `main.ts`.
 * see: docs/game/niveau-hypermarche.md
 */

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
  /**
   * D'où vient la lumière de ce niveau. Défaut `"temps-reel"`.
   *
   * - `"temps-reel"` : ambiante + soleil de la scène, le rig de la Phase 1 —
   *   c'est ce qu'il faut aux boîtes blanches de la gym, qui n'ont aucune
   *   couleur cuite, et c'est sous ce rig que les zones A-E ont été éclairées.
   * - `"bake"` : tout est cuit dans les sommets. Soleil coupé, ambiante à 1,
   *   le rendu vaut exactement texture × couleur cuite.
   * - `"hybride"` : le niveau porte ses propres lampes (`light_*`) et sa
   *   couleur cuite ne sert plus que de masque d'ombre.
   * see: docs/systems/rendu.md#éclairage-de-scène-selon-le-niveau
   */
  lighting?: "temps-reel" | "bake" | "hybride";
}

// Rôle de chaque zone, pourquoi armée/désarmée, note Zone D (pathfinding) :
// see: docs/game/niveau-hypermarche.md
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
  // Blockout gris du niveau v2 (jalon N8) : la STRUCTURE, sans un seul asset
  // — c'est la circulation, la lisibilité et la durée qu'on y juge, pas le
  // décor. Construit par `tools/level_v2/build_blockout.py` depuis le plan de
  // masse validé. Éclairage temps réel : aucun bake, aucune lampe posée.
  {
    id: "blockout_v2",
    label: "Blockout — Niveau v2",
    kind: "gltf",
    gltfName: "blockout_v2",
    startUnarmed: true,
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
